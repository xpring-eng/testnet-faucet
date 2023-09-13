# XRP Ledger Testnet Faucet

Funds new Testnet accounts

## Usage

### Run the server:

```
npm install
NODE_ENV="production" PORT=3000 RIPPLED_URI="wss://s.altnet.rippletest.net:51233" FUNDING_ADDRESS=rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe FUNDING_SECRET=<secret> XRP_AMOUNT=10000
npm start
```

### Fund a new account:

```
curl -X POST localhost:3000/accounts
```

### Funding new accounts multiple times

```
for i in `seq 1 100`; do curl -X POST localhost:3000/accounts; done
```

## Run time options

Environment variables:

- `XRP_AMOUNT`: The number of XRP to fund new accounts with. On the Testnet operated by Ripple, the current funding amount is 1,000 Testnet XRP.

# Logging

This application support both Caspian and BigQuery recording/loggings, see below for intructions.

## Caspian Integration

This application logs and analyzes data using Caspian. To use this feature, you need to provide the necessary Caspian credentials through environment variables.

### Run the server with Caspian (Optional):

Please replace `CASPIAN_ENDPOINT`, `CASPIAN_API_KEY`, `CASPIAN_PRODUCER_NAME`, `CASPIAN_ENTITY_NAME`, `CASPIAN_SCHEMA_TYPE`, and `CASPIAN_SCHEMA_VERSION `with your actual Caspian configurations.

### Caspian Environment Variables:

`CASPIAN_ENDPOINT`: The endpoint for your Caspian integration.
`CASPIAN_API_KEY`: Your Caspian API key for authentication.
`CASPIAN_PRODUCER_NAME`: The name of your data producer.
`CASPIAN_ENTITY_NAME`: The entity name for logging purposes.
`CASPIAN_SCHEMA_TYPE`: The schema type of your data.
`CASPIAN_SCHEMA_VERSION`: The version of your data schema.
Remember to properly secure your environment variables, especially the CASPIAN_API_KEY, to prevent unauthorized access to your Caspian account.

## Google BigQuery Integration

This application logs and analyzes data using Google BigQuery. To use this feature, you need to provide the necessary BigQuery credentials through environment variables.

### Run the server with BigQuery (Optional):

Please replace `BIGQUERY_PROJECT_ID`, `BIGQUERY_CLIENT_EMAIL`, and `BIGQUERY_PRIVATE_KEY` with your actual project ID, client email, and private key.

### BigQuery Environment Variables:

- `BIGQUERY_PROJECT_ID`: The ID of your Google Cloud project.
- `BIGQUERY_CLIENT_EMAIL`: The email address of your service account.
- `BIGQUERY_PRIVATE_KEY`: The private key from your service account JSON key file. Be sure to include the full private key, including the header and footer.

In case you are running this application in a trusted environment (like Google Cloud Platform), you don't need to provide the `BIGQUERY_CLIENT_EMAIL` and `BIGQUERY_PRIVATE_KEY`. The application will use Application Default Credentials (ADC) provided by the environment.

```

Please adjust the details as per your application requirements.

```

### How to run tests on Standalone Node

1. Creating a custom standalone rippled instance

   1. Create a folder called `config`

   2. Create a config file like xrpl.js uses in it’s CI for making standalone rippled instances: https://github.com/XRPLF/xrpl.js/blob/main/.ci-config/rippled.cfg

   If you want to change something, like increase the network_id, you can search the example config for the field name, then add it anywhere. For example:

   [network_id]
   1234

   3. Go to right above `config` in the command line
   4. Use the `config `folder to start a docker container using a command like in xrpl.js tests. Source for command pre-modification + explanation of each piece.

   Modifications:

   Changed the path to the `config` folder from `$PWD/.ci-config` to `$PWD/config:/config/`

   NOTE: This is pointing to a FOLDER not a file!

   Also updated the xrpllabsofficial version to be it’s generic form instead of specifically the beta (which is currently in use for xrpl.js)

   ```
   docker run -p 6006:6006 --interactive -t --volume $PWD/config:/config/ xrpllabsofficial -a --start

   ```

   You should now have a running docker container with your custom config!

   (If you were trying the network_id change, you should see it show up in the docker logs on startup!)

2. In ticket-queue.ts and account.ts, import `sendLedgerAccept` and `delayedLedgerAccept()` from utils.ts

```
async function sendLedgerAccept(client: Client): Promise<unknown> {
  return client.connection.request({ command: "ledger_accept" });
}
async function delayedLedgerAccept(): Promise<unknown> {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });
      return sendLedgerAccept(client);
    }

```

use `delayedLedgerAccept()` before `client.submitAndWait()` and `await sendLedgerAccept()` after `client.submit()` in order to close the ledger on a standalone node.
