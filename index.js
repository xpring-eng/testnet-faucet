const express = require('express')
const app = express()
const port = 3000
const RippleAPI = require('ripple-lib').RippleAPI

const rippledUri = process.env['RIPPLED_URI']
const address = process.env['FUNDING_ADDRESS']
const secret = process.env['FUNDING_SECRET']
const amount = process.env['XRP_AMOUNT']

app.post('/accounts', (req, res) => {
  const api = new RippleAPI({
    server: rippledUri
  });

  api.connect().then(() => {
    console.log('Connected...')

    const account = api.generateAddress()
    console.log('Generated new account:', account.address)

    return api.preparePayment(address, {
      source: {
        address: address,
        maxAmount: {
          value: amount,
          currency: 'XRP'
        }
      },
      destination: {
        address: account.address,
        amount: {
          value: amount,
          currency: 'XRP'
        }
      }
    }, {maxLedgerVersionOffset: 5}).then(prepared => {
      const {signedTransaction} = api.sign(prepared.txJSON, secret);
      console.log('Payment transaction signed...');
      api.submit(signedTransaction).then(() => {
        console.log(`Funded ${account.address} with ${amount} XRP`)
        res.send({
          account: account,
          balance: Number(amount)
        })
      })
    })
  }).catch(err => { console.log(err) })
})

app.listen(port, () => console.log(`Altnet faucet listening on port ${port}!`))