# XRP Ledger Testnet Faucet

Funds new Testnet accounts

## Usage

### Run the server:

````
npm install
NODE_ENV="production" PORT=3000 RIPPLED_URI="wss://s.altnet.rippletest.net:51233" FUNDING_ADDRESS=rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe FUNDING_SECRET=<secret> XRP_AMOUNT=10000 npm start
````

Do not run multiple instances of the Faucet application using the same funding address. Since the Faucet currently tracks the funding account's sequence number internally, a second instance of the Faucet would consume sequence numbers that the first instance considers to be available. This is a temporary error, though: clients can always retry, and retried requests will generally succeed.

### Fund a new account:

```
curl -X POST localhost:3000/accounts
```


## Run time options

Environment variables:

- `XRP_AMOUNT`: The number of XRP to fund new accounts with. On the Testnet operated by Ripple, the current funding amount is 1,000 Testnet XRP.


## Google BigQuery Integration

This application logs and analyzes data using Google BigQuery. To use this feature, you need to provide the necessary BigQuery credentials through environment variables.

### Run the server with BigQuery (Optional):

Please replace `"your_project_id"`, `"your_client_email"`, and `"your_private_key"` with your actual project ID, client email, and private key.

### BigQuery Environment Variables:

- `BIGQUERY_PROJECT_ID`: The ID of your Google Cloud project.
- `BIGQUERY_CLIENT_EMAIL`: The email address of your service account.
- `BIGQUERY_PRIVATE_KEY`: The private key from your service account JSON key file. Be sure to include the full private key, including the header and footer.

In case you are running this application in a trusted environment (like Google Cloud Platform), you don't need to provide the `BIGQUERY_CLIENT_EMAIL` and `BIGQUERY_PRIVATE_KEY`. The application will use Application Default Credentials (ADC) provided by the environment.
```

Please adjust the details as per your application requirements.


