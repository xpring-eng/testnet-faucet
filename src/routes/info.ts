const os = require("os");
import { Request, Response } from "express";
import { connect } from "../client";
import { fundingWallet } from "../wallet";
import { ServerInfoResponse } from "ripple-lib/dist/npm/common/types/commands";
import { checkForWarning, format } from "../utils";
import { AccountInfoResponse, FeeResponse } from "xrpl";

export default async function (req: Request, res: Response) {
  let client = await connect();
  try {
    const serverInfo: ServerInfoResponse = await client.request({
      command: "server_info",
    });
    checkForWarning(serverInfo);
    const feeInfo: FeeResponse = await client.request({
      command: "fee",
    });
    checkForWarning(feeInfo);
    const accountInfo: AccountInfoResponse = await client.request({
      command: "account_info",
      params: {
        account: fundingWallet.classicAddress,
        ledger_index: "current",
        queue: true,
      },
    });
    console.log(
      "Returning /info - ledgerVersion: " +
        serverInfo.validatedLedger.ledgerVersion +
        ", age: " +
        serverInfo.validatedLedger.age +
        ", expected_ledger_size: " +
        feeInfo.result.expected_ledger_size +
        ", open_ledger_fee: " +
        feeInfo.result.drops.open_ledger_fee +
        ", hostID: " +
        serverInfo.hostID
    );
    const processUptime = process.uptime();
    const osUptime = os.uptime();
    res.send({
      faucetVersion: "0.0.2",
      processUptime,
      processUptimeHhMmSs: format(processUptime),
      osUptime,
      osUptimeHhMmSs: format(osUptime),
      balance: accountInfo.result.account_data.Balance,
      rippled: accountInfo,
      feeInfo,
    });
  } catch (error) {
    console.error("/info error:", error);
    res.status(500).send({
      error: "Server load is too high. Request info later",
    });
    await client.disconnect();
    client = await connect();
  }
}
