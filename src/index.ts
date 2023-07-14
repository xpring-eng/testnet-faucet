import express from 'express';
import cors from 'cors'
import { connect } from './client';
import { Payment, TransactionMetadata, Wallet, xrpToDrops } from 'xrpl';
import { fundingWallet } from './wallet';
import { getDestinationWallet } from './destination-wallet';
import { BigQuery } from '@google-cloud/bigquery';

const MAX_AMOUNT = 1000000
const defaultAmount = process.env['XRP_AMOUNT']
const port = process.env['PORT']

/// bigQuery credentials
const datasetId = process.env['BIGQUERY_DATASET_ID'];
const tableId = process.env['BIGQUERY_TABLE_ID'];
const clientEmail = process.env['BIGQUERY_CLIENT_EMAIL'];
const projectId = process.env['BIGQUERY_PROJECT_ID'];
const privateKey = process.env['BIGQUERY_PRIVATE_KEY'] ? process.env['BIGQUERY_PRIVATE_KEY'].replace(/\\n/g, '\n') : ""

const app = express()
app.use(cors())
app.use(express.json())

app.post('/accounts', async (req, res) => {
  const reqId = (Math.random() + 1).toString(36).substr(2, 5)
  const client = await connect()

  let account

  if (req.body.destination) {
    try {
      account = getDestinationWallet(req.body.destination)
      console.log(`${reqId}| User-specified destination: ${account}`)
    } catch {
      return res.status(400).send({
        error: 'Invalid destination'
      })
    }

  } else {
    account = Wallet.generate()
    console.log(`${reqId}| Generated new account: ${account.address}`)
  }

  let amount = defaultAmount
  if (req.body.xrpAmount) {
    // Disallows fractional XRP
    if (!req.body.xrpAmount.match(/^\d+$/)) {
      return res.status(400).send({
        error: 'Invalid amount',
        detail: 'Must be an integer'
      })
    }
    let requestedAmountNumber = Number(req.body.xrpAmount)
    if (requestedAmountNumber < 0 || requestedAmountNumber > MAX_AMOUNT || typeof requestedAmountNumber !== 'number') {
      return res.status(400).send({
        error: 'Invalid amount'
      })
    }
    amount = requestedAmountNumber.toString()
  }

  const payment: Payment = {
    TransactionType: 'Payment',
    Account: fundingWallet.address,
    Amount: xrpToDrops(amount),
    Destination: account.address
  }

  const { result } = await client.submitAndWait(payment, {wallet: fundingWallet})
  const status = (result.meta as TransactionMetadata).TransactionResult;
  const response = {
    account,
    amount: Number(amount)
  }

  if ((status === 'tesSUCCESS' || status === 'terQUEUED')) {
    console.log(`${reqId}| Funded ${account.address} with ${amount} XRP (${status})`)

    if (clientEmail && privateKey && projectId) {
      const { userAgent = "", usageContext = "" } = req.body;
      const memos = req.body.memos ? req.body.memos.map((memo: any) => ({ memo })) : [];
      const rows = [
        {
          user_agent: userAgent,
          usage_context: usageContext,
          memos: memos,
          account: ('xAddress' in account) ? account.xAddress : account.getXAddress(),
          amount: amount,
        },
      ];
      const bigquery = new BigQuery(
        {
          projectId: projectId,
          credentials:{
            client_email: clientEmail,
            private_key: privateKey,
          }
        }
      );

      bigquery
        .dataset(datasetId)
        .table(tableId)
        .insert(rows, (error) => {
          if (error) {
            console.warn("WARNING: Failed to insert into BigQuery", JSON.stringify(error, null, 2));
          } else {
            console.log(`Inserted ${rows.length} rows`);
          }
        });
      console.log("inserted big query")
    }

    res.send(response)
  }
})

app.get('/info', () => {

})

const server = app.listen(port, () => console.log(`Altnet faucet, node version: ${process.version}, listening on port: ${port}`))
server.setTimeout(20 * 1000)
