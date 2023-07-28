import { Request, Response } from "express";
import { getConnectedClient, resetClient } from "../client";
import { checkForWarning, format } from "../utils";
import { FeeResponse, ServerInfoResponse } from "xrpl";

export default async function (req: Request, res: Response) {
  let client = await getConnectedClient();
  try {
    const serverInfo: ServerInfoResponse = await client.request({
      command: "server_info",
    });
    checkForWarning(serverInfo.result);

    const feeInfo: FeeResponse = await client.request({
      command: "fee",
    });
    checkForWarning(feeInfo.result);
    console.log(
      `Returning /status - ledgerVersion: ${serverInfo.result.info.validated_ledger.seq}, age: ${serverInfo.result.info.validated_ledger.age}, expected_ledger_size: ${feeInfo.result.expected_ledger_size}, open_ledger_fee: ${feeInfo.result.drops.open_ledger_fee}, hostID: ${serverInfo.result.info.hostid}`
    );

    const processUptime = process.uptime();

    const text = `*XRP Test Net Faucet:* https://xrpl.org/xrp-testnet-faucet.html
*Uptime:* ${format(processUptime)}
*rippled* buildVersion: ${serverInfo.result.info.build_version}
> completeLedgers: ${serverInfo.result.info.complete_ledgers}
> loadFactor: ${serverInfo.result.info.load_factor}
> peers: ${serverInfo.result.info.peers}
> serverState: ${serverInfo.result.info.server_state}
> validatedLedger.ledgerVersion: ${serverInfo.result.info.validated_ledger.seq}
> hostID: ${serverInfo.result.info.hostid}
> open_ledger_fee: ${feeInfo.result.drops.open_ledger_fee} drops
> expected_ledger_size: ${feeInfo.result.expected_ledger_size}
Full info: https://faucet.altnet.rippletest.net/info`;

    res.send({
      response_type: "in_channel",
      text: text,
    });
  } catch (error) {
    console.log("/status error:", error);
    res.status(500).send({
      error: "Server load is too high. Request status later",
    });
    await resetClient("status");
  }
}
