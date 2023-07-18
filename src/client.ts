import { Client } from "xrpl";
import { config } from "./config";

let client = new Client(config.RIPPLED_URI);
let clientCreatedDate: number | null = Date.now();

client.on("error", (errorCode, errorMessage) => {
  console.log("Client error: " + errorCode + ": " + errorMessage);
});

client.on("connected", () => {
  console.log("Client connected");
});

client.on("disconnected", (code) => {
  // code - [close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) sent by the server
  // will be 1000 if this was normal closure
  console.log("Client disconnected, code:", code);
});

export function createClient(): Client {
  if (client) {
    return client;
  }
  client = new Client(config.RIPPLED_URI);
  clientCreatedDate = Date.now();
  return client;
}

export function getClientCreationDate(): number | null {
  return clientCreatedDate;
}

export async function connect(): Promise<Client> {
  if (!client.isConnected()) {
    await client.connect();
  }
  return client;
}

export async function disconnect(): Promise<void> {
  await client.disconnect();
}
export const MIN_RESET_INTERVAL_MS = 10 * 1000;

export async function resetClient(reqId: string) {
  const clientCreationDate = getClientCreationDate();

  if (clientCreationDate) {
    const clientAge = Date.now() - clientCreationDate;
    if (clientAge < MIN_RESET_INTERVAL_MS) {
      console.log(
        `${reqId}| not resetting client, age=${clientAge} ms < 10 sec`
      );
      return; // prevent client from being reset more often than once per 10 sec
    }
  }

  console.log(`${reqId}| resetting client...`);
  await disconnect();
  console.log(`${reqId}| successfully disconnected 'by user'`);

  await createClient();
  await connect();
  console.log(`${reqId}| client reconnected.`);
}
