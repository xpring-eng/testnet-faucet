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
