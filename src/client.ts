import { Client } from "xrpl";
import { config } from "./config";

let { client, clientCreatedDate: _clientCreatedDate } = createClient();

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

export function createClient(existingClient?: Client): {
  client: Client;
  clientCreatedDate: number;
} {
  let createdDate: number;
  let client: Client;

  if (existingClient) {
    client = existingClient;
    createdDate = _clientCreatedDate;
  } else {
    client = new Client(config.RIPPLED_URI);
    createdDate = Date.now();
  }

  return { client, clientCreatedDate: createdDate };
}

export function getClientCreatedDate(): number {
  return _clientCreatedDate;
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
  const clientCreationDate = getClientCreatedDate();

  if (clientCreationDate) {
    const clientAge = Date.now() - clientCreationDate;
    if (clientAge < MIN_RESET_INTERVAL_MS) {
      console.log(
        `${reqId}| not resetting client, age=${clientAge} ms < ${
          MIN_RESET_INTERVAL_MS / 1000
        } sec`
      );
      return; // prevent client from being reset more often than once per MIN_RESET_INTERVAL_MS / 1000 sec
    }
  }

  console.log(`${reqId}| resetting client...`);
  await disconnect();
  console.log(`${reqId}| successfully disconnected 'by user'`);

  const newClientData = await createClient();
  client = newClientData.client;
  _clientCreatedDate = newClientData.clientCreatedDate;
  await connect();
  console.log(`${reqId}| client reconnected.`);
}
