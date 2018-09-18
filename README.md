# XRP Ledger Testnet Faucet

Funds new testnet accounts

## Usage

````
npm install
RIPPLED_URI="wss://s.altnet.rippletest.net:51233" FUNDING_ADDRESS=rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe FUNDING_SECRET=<secret> XRP_AMOUNT=10000 npm start
````

```
curl -X POST localhost:3000/accounts
```