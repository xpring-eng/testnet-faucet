import { Client } from "xrpl";
import { config } from "./config";
import { populateTicketQueue } from "./ticket-queue";

let { client, clientCreatedDate: _clientCreatedDate } = createClient();
let connecting = false;

// connect the client and populate the ticket queue immediately after creation
getConnectedClient();

client.on("error", (errorCode, errorMessage) => {
  console.log("Client error: " + errorCode + ": " + errorMessage);
});

client.on("connected", () => {
  console.log("Client connected");
});

client.on("disconnected", (code) => {
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

export async function getConnectedClient(): Promise<Client> {
  // If the client is not defined, not connected, and not currently being connected
  if (!client || (!client.isConnected() && !connecting)) {
    connecting = true;
    try {
      if (!client) {
        const clientInfo = await createClient();
        client = clientInfo.client;
        _clientCreatedDate = clientInfo.clientCreatedDate;
      }
      if (!client.isConnected()) {
        await client.connect();
        await populateTicketQueue(client);
      }
    } catch (error) {
      console.error(`Failed to get connected client. Error: ${error.message}`);
      throw error;
    } finally {
      connecting = false;
    }
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
  await getConnectedClient();
  await populateTicketQueue(client); // Populate the ticket queue after reconnection
  console.log(`${reqId}| client reconnected.`);
}
