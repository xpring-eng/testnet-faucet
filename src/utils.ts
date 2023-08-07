import { Client } from "xrpl";

export function format(seconds: number) {
  function pad(s: number) {
    return (s < 10 ? "0" : "") + s;
  }
  let hours = Math.floor(seconds / (60 * 60));
  let minutes = Math.floor((seconds % (60 * 60)) / 60);
  seconds = Math.floor(seconds % 60);

  return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
}

export function checkForWarning(s: any) {
  if (s && s.warning) {
    console.log("GOT WARNING: " + s.warning);
  }
}

// utils functions for standalone node
export async function sendLedgerAccept(client: Client): Promise<unknown> {
  return client.connection.request({ command: "ledger_accept" });
}
export async function delayedLedgerAccept(client: Client): Promise<unknown> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1000);
  });
  return sendLedgerAccept(client);
}
