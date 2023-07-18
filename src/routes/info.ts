const os = require("os");
import { Request, Response } from "express";
import { connect, resetClient } from "../client";
import { fundingWallet } from "../wallet";
import { checkForWarning, format } from "../utils";
import { AccountInfoResponse, FeeResponse, ServerInfoResponse } from "xrpl";
import * as packageJson from "../../package.json";
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
        serverInfo.result.info.build_version +
        ", age: " +
        serverInfo.result.info.validated_ledger.age +
        ", expected_ledger_size: " +
        feeInfo.result.expected_ledger_size +
        ", open_ledger_fee: " +
        feeInfo.result.drops.open_ledger_fee +
        ", hostID: " +
        serverInfo.result.info.hostid
    );
    const processUptime = process.uptime();
    const osUptime = os.uptime();
    res.send({
      faucetVersion: packageJson.version,
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
    await resetClient("info");
  }
}
