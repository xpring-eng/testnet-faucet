# XRP Ledger Testnet Faucet

Funds new Testnet accounts

## Usage

### Run the server:

1. Add / update `.env` with the following values:

```
NODE_ENV="production"
PORT=3000
RIPPLED_URI="wss://s.altnet.rippletest.net:51233"
FUNDING_ADDRESS=<address>
FUNDING_SECRET=<secret>
XRP_AMOUNT=10000
```

- For testing, create an account on testnet or use an existing one by updating `FUNDING_ADDRESS` and `FUNDING_SECRET`
- For production testnet faucet, use the account with the address `rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe` and it's corresponding secret
- Production environments should also configure either the BigQuery or Caspian environment variables as specified below

2. Run the following commands:

```
npm install
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

```
Remember to properly secure your environment variables, especially the CASPIAN_API_KEY, to prevent unauthorized access to your Caspian account.
```

## Google BigQuery Integration

This application logs and analyzes data using Google BigQuery. To use this feature, you need to provide the necessary BigQuery credentials through environment variables.

### Run the server with BigQuery (Optional):

Please replace `BIGQUERY_PROJECT_ID`, `BIGQUERY_CLIENT_EMAIL`, and `BIGQUERY_PRIVATE_KEY` with your actual project ID, client email, and private key.

### BigQuery Environment Variables:

- `BIGQUERY_PROJECT_ID`: The ID of your Google Cloud project.
- `BIGQUERY_CLIENT_EMAIL`: The email address of your service account.
- `BIGQUERY_PRIVATE_KEY`: The private key from your service account JSON key file. Be sure to include the full private key, including the header and footer.

In case you are running this application in a trusted environment (like Google Cloud Platform), you don't need to provide the `BIGQUERY_CLIENT_EMAIL` and `BIGQUERY_PRIVATE_KEY`. The application will use Application Default Credentials (ADC) provided by the environment.
