import { Request, Response } from "express";
import { getConnectedClient, resetClient } from "../client";
import { getDestinationAccount } from "../destination-wallet";
import { Client, Payment, Wallet, xrpToDrops } from "xrpl";
import { Account, FundedResponse } from "../types";
import { fundingWallet } from "../wallet";
import { BigQuery } from "@google-cloud/bigquery";
import { config } from "../config";
import { getTicket } from "../ticket-queue";
import rTracer from "cls-rtracer";
import { incrementTxRequestCount, incrementTxCount } from "../index";

export default async function (req: Request, res: Response) {
  incrementTxRequestCount();
  const client = await getConnectedClient();

  let account: Account;
  let wallet: Wallet;

  if (req.body.destination) {
    try {
      account = getDestinationAccount(req.body.destination);
      console.log(`${rTracer.id()} | User-specified destination: ${account}`);
    } catch {
      return res.status(400).send({
        error: "Invalid destination",
      });
    }
  } else {
    wallet = Wallet.generate();
    account = {
      xAddress: wallet.getXAddress(),
      address: wallet.classicAddress,
      classicAddress: wallet.classicAddress,
    };
    console.log(`${rTracer.id()} | Generated new account: ${account.address}`);
  }

  let amount = config.XRP_AMOUNT;
  if (req.body.xrpAmount) {
    // Disallows fractional XRP
    if (!req.body.xrpAmount.match(/^\d+$/)) {
      return res.status(400).send({
        error: "Invalid amount",
        detail: "Must be an integer",
      });
    }
    let requestedAmountNumber = Number(req.body.xrpAmount);
    if (
      requestedAmountNumber < 0 ||
      requestedAmountNumber > Number(config.MAX_AMOUNT) ||
      typeof requestedAmountNumber !== "number"
    ) {
      return res.status(400).send({
        error: "Invalid amount",
      });
    }
    amount = requestedAmountNumber.toString();
  }

  const payment: Payment = {
    TransactionType: "Payment",
    Account: fundingWallet.address,
    Amount: xrpToDrops(amount),
    Destination: account.address,
    Sequence: 0,
  };
  if (typeof account.tag === "number") {
    payment.DestinationTag = account.tag;
  }

  let transactionHash = fundingWallet.sign(payment).hash;
  try {
    let result;
    try {
      result = await submitPaymentWithTicket(payment, client, fundingWallet);
      transactionHash = result.hash;
    } catch (err) {
      console.log(
        `${rTracer.id()} | Failed to submit payment ${transactionHash}: ${err}`
      );
      res.status(500).send({
        error: "Unable to fund account. Try again later",
        account,
      });
      await resetClient(rTracer.id().toString());
      return;
    }

    const status = result.result.engine_result;
    const response: FundedResponse = {
      account: account,
      amount: Number(amount),
      transactionHash: transactionHash,
    };

    if (wallet && wallet.seed) {
      response.seed = wallet.seed;
    }

    if (status === "tesSUCCESS" || status === "terQUEUED") {
      console.log(
        `${rTracer.id()} | Funded ${
          account.address
        } with ${amount} XRP (${status}), paymentHash: ${transactionHash}`
      );

      if (config.BIGQUERY_PROJECT_ID) {
        try {
          await insertIntoBigQuery(account, amount, req.body);
          console.log("inserted big query");
        } catch (error) {
          console.warn(`Failed to insert into BigQuery: ${error}`);
        }
      }

      incrementTxCount();
      res.send(response);
    }
  } catch (err) {
    console.log(`${rTracer.id()}| ${err}`);
    res.status(500).send({
      error: "Internal Server Error",
      account,
    });
  }
}

async function insertIntoBigQuery(
  account: Account,
  amount: string,
  reqBody: any
): Promise<void> {
  const { userAgent = "", usageContext = "" } = reqBody;
  const memos = reqBody.memos
    ? reqBody.memos.map((memo: any) => ({ memo }))
    : [];
  const rows = [
    {
      user_agent: userAgent,
      usage_context: usageContext,
      memos: memos,
      account: account.xAddress,
      amount: amount,
    },
  ];
  const bigquery = new BigQuery({
    projectId: config.BIGQUERY_PROJECT_ID,
    credentials: {
      client_email: config.BIGQUERY_CLIENT_EMAIL,
      private_key: config.BIGQUERY_PRIVATE_KEY,
    },
  });

  return new Promise((resolve, reject) => {
    bigquery
      .dataset(config.BIGQUERY_DATASET_ID)
      .table(config.BIGQUERY_TABLE_ID)
      .insert(rows, (error) => {
        if (error) {
          console.warn(
            "WARNING: Failed to insert into BigQuery",
            JSON.stringify(error, null, 2)
          );
          reject(error);
        } else {
          console.log(`Inserted ${rows.length} rows`);
          resolve();
        }
      });
  });
}

async function submitPaymentWithTicket(
  payment: Payment,
  client: Client,
  fundingWallet: Wallet,
  maxRetries = 3
) {
  let retryCount = 0;
  let result;
  let hash;
  while (retryCount < maxRetries) {
    payment.TicketSequence = await getTicket(client);
    payment = await client.autofill(payment);
    const { tx_blob: paymentBlob, hash: paymentHash } =
      fundingWallet.sign(payment);
    hash = paymentHash;
    result = (await client.submit(paymentBlob)).result;
    if (result.engine_result === "tefNO_TICKET") {
      retryCount++;
      console.log(`Retrying transaction ${hash} (${retryCount}/${maxRetries})`);
    } else if (result.engine_result === "tesSUCCESS") {
      break;
    } else {
      throw new Error(
        `Failed to submit transaction ${hash} with ticket, error code: ${result.engine_result}`
      );
    }
  }

  if (retryCount >= maxRetries) {
    throw new Error(
      `Failed to submit transaction ${hash} with ticket after multiple attempts`
    );
  }

  return { result, hash };
}