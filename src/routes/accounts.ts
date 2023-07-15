import { Request, Response } from 'express'
import { connect } from '../client';
import { getDestinationWallet } from '../destination-wallet';
import { Payment, Wallet, xrpToDrops } from 'xrpl';
import { fundingWallet } from '../wallet';
import { BigQuery } from '@google-cloud/bigquery';
import { config } from '../config';
import { getTicket } from '../ticket-queue';
import rTracer from 'cls-rtracer';

export default async function(req: Request, res: Response)  {
  const reqId = (Math.random() + 1).toString(36).substr(2, 5)
  const client = await connect()

  let account

  if (req.body.destination) {
    try {
      account = getDestinationWallet(req.body.destination)
      console.log(`${rTracer.id()} | User-specified destination: ${account}`)
    } catch {
      return res.status(400).send({
        error: 'Invalid destination'
      })
    }

  } else {
    account = Wallet.generate()
    console.log(`${rTracer.id()} | Generated new account: ${account.address}`)
  }

  let amount = config.XRP_AMOUNT
  if (req.body.xrpAmount) {
    // Disallows fractional XRP
    if (!req.body.xrpAmount.match(/^\d+$/)) {
      return res.status(400).send({
        error: 'Invalid amount',
        detail: 'Must be an integer'
      })
    }
    let requestedAmountNumber = Number(req.body.xrpAmount)
    if (requestedAmountNumber < 0 || requestedAmountNumber > config.MAX_AMOUNT || typeof requestedAmountNumber !== 'number') {
      return res.status(400).send({
        error: 'Invalid amount'
      })
    }
    amount = requestedAmountNumber.toString()
  }

  const payment: Payment = {
    TransactionType: 'Payment',
    Account: fundingWallet.address,
    Amount: xrpToDrops(amount),
    Destination: account.address,
    Sequence: 0,
    TicketSequence: await getTicket(client)
  }

  const { result } = await client.submit(payment, {wallet: fundingWallet})
  const status = result.engine_result
  const response = {
    account,
    amount: Number(amount)
  }

  // TODO: check for tefNO_TICKET and try again with another ticket
  if ((status === 'tesSUCCESS' || status === 'terQUEUED')) {
    console.log(`${reqId} | Funded ${account.address} with ${amount} XRP (${status})`)

    if (config.BIGQUERY_PROJECT_ID) {
      const { userAgent = "", usageContext = "" } = req.body;
      const memos = req.body.memos ? req.body.memos.map((memo: any) => ({ memo })) : [];
      const rows = [
        {
          user_agent: userAgent,
          usage_context: usageContext,
          memos: memos,
          account: ('xAddress' in account) ? account.xAddress : account.getXAddress(),
          amount: amount,
        },
      ];
      const bigquery = new BigQuery(
        {
          projectId: config.BIGQUERY_PROJECT_ID,
          credentials:{
            client_email: config.BIGQUERY_CLIENT_EMAIL,
            private_key: config.BIGQUERY_PRIVATE_KEY,
          }
        }
      );

      bigquery
        .dataset(config.BIGQUERY_DATASET_ID)
        .table(config.BIGQUERY_TABLE_ID)
        .insert(rows, (error) => {
          if (error) {
            console.warn("WARNING: Failed to insert into BigQuery", JSON.stringify(error, null, 2));
          } else {
            console.log(`Inserted ${rows.length} rows`);
          }
        });
      console.log("inserted big query")
    }

    res.send(response)
  }
}
