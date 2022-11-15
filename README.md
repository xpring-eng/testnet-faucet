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