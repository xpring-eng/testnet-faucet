const os = require('os')
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env['PORT']
const RippleAPI = require('ripple-lib').RippleAPI
const addressCodec = require('ripple-address-codec')
const { BigQuery } = require("@google-cloud/bigquery");


const rippledUri = process.env['RIPPLED_URI']
const address = process.env['FUNDING_ADDRESS']
const secret = process.env['FUNDING_SECRET']
const defaultAmount = process.env['XRP_AMOUNT']
const MAX_AMOUNT = '1000000'

/// bigQuery credentials
const datasetId = process.env['BIGQUERY_DATASET_ID'];
const tableId = process.env['BIGQUERY_TABLE_ID'];
const clientEmail = process.env['BIGQUERY_CLIENT_EMAIL'];
const projectID = process.env['BIGQUERY_PROJECT_ID'];
const privateKey = process.env['BIGQUERY_PRIVATE_KEY'].replace(/\\n/g, '\n');



app.use(cors())
app.use(express.json())

let txCount = 0
let txRequestCount = 0
let api = null
let apiCreatedDate = null

function resetRippleAPI(reqId) {
  if (apiCreatedDate) {
    const apiAge = Date.now() - apiCreatedDate
    if (apiAge < (10 * 1000)) {
      console.log(`${reqId}| not resetting api, age=${apiAge} ms < 10 sec`)
      return // prevent api from being reset more often than once per 10 sec
    }
  }
  console.log(`${reqId}| resetting api...`)
  let oldApi = api
  oldApi.disconnect().then(() => {
    console.log(`${reqId}| successfully disconnected 'by user'`)
    oldApi = null
  })
  api = null
  createRippleAPI()
}

function createRippleAPI() {
  if (api) {
    return
  }

  api = new RippleAPI({
    server: rippledUri
  })

  api.connection.on('error', error => {
    console.log('Connection error: ' + error)
    console.log(error)
  })

  if (api.connection._ws) {
    console.log('setting _ws error handler')
    api.connection._ws.on('error', error => {
      console.log('_ws error: ' + error)
      console.log(error)
    })
  } else {
    console.log('no _ws yet')
  }

  api.on('error', (errorCode, errorMessage) => {
    console.log('RippleAPI error: ' + errorCode + ': ' + errorMessage)
  })

  api.on('connected', () => {
    console.log('RippleAPI connected')
  })

  api.on('disconnected', (code) => {
    // code - [close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) sent by the server
    // will be 1000 if this was normal closure
    console.log('RippleAPI disconnected, code:', code)
  })

  apiCreatedDate = Date.now()
}

function checkForWarning(s) {
  if (s && s.warning) {
    console.log('GOT WARNING: ' + s.warning)
    // TODO: Look for this in the logs
  }
}

let nextAvailableSeq = null

app.post('/accounts', (req, res) => {
  txRequestCount++

  const reqId = (Math.random() + 1).toString(36).substr(2, 5)
  // const reqId = req.ip + req.secure ? ' s' : ' u'

  try {
    createRippleAPI()
    let account
    if (req.body.destination) {
      if (api.isValidAddress(req.body.destination)) {
        let xAddress
        let classicAddress
        let tag

        if (req.body.destination.startsWith('T')) {
          const t = addressCodec.xAddressToClassicAddress(req.body.destination)
          xAddress = req.body.destination
          classicAddress = t.classicAddress
          tag = t.tag
        } else {
          xAddress = addressCodec.classicAddressToXAddress(req.body.destination, false, true)
          classicAddress = req.body.destination
        }
        account = {
          xAddress,
          classicAddress,
          address: classicAddress,
          tag
        }
      } else {
        return res.status(400).send({
          error: 'Invalid destination'
        })
      }
      console.log(`${reqId}| User-specified destination: ${account.xAddress}`)
    } else {
      account = api.generateAddress({
        test: true
      })
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

    api.connect().then(() => {
      console.log(`${reqId}| (connected)`)
      if (nextAvailableSeq) {
        // next tx should use the next seq
        nextAvailableSeq++
        return nextAvailableSeq - 1
      } else {
        return getSequenceFromAccountInfo({reqId, shouldAdvanceSequence: true})
      }
    }).then(sequence => {
      console.log(`${reqId}| Preparing payment with destination=${account.address}, sequence: ${sequence}`)
      const payment = {
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
        },
        memos: req.body.memos ? [...req.body.memos] : [],
      }
      if (account.tag) payment.destination.tag = account.tag
      return api.preparePayment(address, payment, {maxLedgerVersionOffset: 5, sequence})
    }).then(prepared => {
      checkForWarning(prepared)

      const {signedTransaction} = api.sign(prepared.txJSON, secret)
      return api.submit(signedTransaction)
    }).then((result) => {
      checkForWarning(result)

      if (result.engine_result === 'tesSUCCESS' || result.engine_result === 'terQUEUED') {
        // || result.engine_result === 'terPRE_SEQ'
        console.log(`${reqId}| Funded ${account.address} with ${amount} XRP (${result.engine_result})`)
        const response = {
          account,
          amount: Number(amount)
        }
        /// insert into bigQuery
        const { userAgent = "", usageContext = "", memos = "" } = req.body;
        const address = account;
        const rows = [
        {
            user_agent: userAgent,
            usage_context: usageContext,
            memos: memos,
            account: address,
            amount: amount,
            sequence: sequence, 
        },
        ];

        if (clientEmail && privateKey && projectID) {
          const bigquery = new BigQuery(
            {
              projectID: projectID,
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
                  console.warn("WARNING: Failed to insert into BigQuery", error);
                } else {
                  console.log(`Inserted ${rows.length} rows`);
                }
              });
        }
        
        /// prepare res
        if (!req.body.destination) {
          response.balance = Number(amount)
        }
        res.send(response)
        txCount++
      } else if (result.engine_result === 'tefPAST_SEQ' || result.engine_result === 'terPRE_SEQ') {
        // occurs when we re-connect to a different rippled server
        //???
        console.log(`${reqId}| Failed to fund ${account.address} with ${amount} XRP (${result.engine_result})`)
        res.status(503).send({
          error: 'Failed to fund account. Try again later',
          account
        })

        // advance cached sequence if needed:
        getSequenceFromAccountInfo({reqId, shouldAdvanceSequence: false})
      } else {
        console.log(`${reqId}| Unrecognized failure to fund ${account.address} with ${amount} XRP (${result.engine_result})`)
        res.status(503).send({
          error: 'Failed to fund account',
          account
        })
        // TODO: Look for this in the logs
        console.log(`${reqId}| Setting nextAvailableSeq=null`)
        nextAvailableSeq = null
      }
    }).catch(err => {
      console.log(`${reqId}| ${err}`)
      // [DisconnectedError(websocket was closed)]
      // from prepare* call
      res.status(500).send({
        error: 'Unable to fund account. Server load is too high. Try again later',
        account
      })
      nextAvailableSeq = null
      resetRippleAPI(reqId)
    })
  } catch (e) {
    console.log('/accounts error:', e)
    res.status(500).send({
      error: 'Internal Server Error'
    })
  }
})

// required:
// - options.reqId
// - options.shouldAdvanceSequence
function getSequenceFromAccountInfo(options) {
  const reqId = options.reqId

  console.log(`${reqId}| (requesting account info...)`)
  return api.request('account_info', {
    account: address,
    strict: true,
    ledger_index: 'current',
    queue: true
  }).then(info => {
    checkForWarning(info)

    let sequence

    sequence = info.account_data.Sequence
    if (info.queue_data && info.queue_data.transactions && info.queue_data.transactions.length) {
      const seqs = info.queue_data.transactions.reduce((acc, curr) => {
        acc.push(curr.seq)
      }, [])
      seqs.sort((a, b) => a - b) // numeric sort, low to high
      for (let i = 0; i < seqs.length; i++) {
        if (sequence === seqs[i]) {
          sequence++
        } else if (sequence < seqs[i]) {
          console.log(`${reqId}| WARNING: found gap in Sequence: account_data.Sequence=${info.account_data.Sequence}, sequence=${sequence}, seqs[${i}]=${seqs[i]}`)
        } else if (sequence > seqs[i]) {
          console.log(`${reqId}| ERROR: invariant violated: account_data.Sequence=${info.account_data.Sequence}, sequence=${sequence}, seqs[${i}]=${seqs[i]}`)
        }
      }
    }

    if (!nextAvailableSeq || nextAvailableSeq === sequence) {
      if (options.shouldAdvanceSequence === true) {
        // the sequence we found is the one we should use for this tx;
        // sequence + 1 will be the one to use in the next tx
        nextAvailableSeq = sequence + 1
      }
    } else if (nextAvailableSeq > sequence) {
      console.log(`${reqId}| WARNING: nextAvailableSeq=${nextAvailableSeq} > sequence=${sequence}. Some prior tx likely was not applied. Setting nextAvailableSeq=${options.shouldAdvanceSequence ? sequence : sequence + 1}.`)
      nextAvailableSeq = sequence
      // TODO: consider setting nextAvailableSeq=null
      if (options.shouldAdvanceSequence === true) {
        // sequence = nextAvailableSeq
        nextAvailableSeq++
      }
    } else if (nextAvailableSeq < sequence) {
      console.log(`${reqId}| WARNING: nextAvailableSeq=${nextAvailableSeq} < sequence=${sequence}. Another process/server is using this funding account, or we were disconnected and reconnected to a different rippled server`)
      nextAvailableSeq = sequence
      if (options.shouldAdvanceSequence === true) {
        nextAvailableSeq++
      }
    }
    console.log(`${reqId}| called account_info; sequence: ${sequence}, account_data.Sequence=${info.account_data.Sequence}, queue_data.transactions.length=${info.queue_data && info.queue_data.transactions && info.queue_data.transactions.length}`)

    return sequence
  })
}

app.get('/info', (req, res) => {
  createRippleAPI()
  api.connect().then(() => {
    return api.getServerInfo()
  }).then(info => {
    checkForWarning(info)

    return api.request('fee').then(fee => {
      checkForWarning(fee)

      return api.request('account_info', {
        account: address,
        strict: true,
        ledger_index: 'current',
        queue: true
      }).then(account => {
        console.log('Returning /info - ledgerVersion: ' + info.validatedLedger.ledgerVersion + ', age: ' + info.validatedLedger.age + ', expected_ledger_size: ' + fee.expected_ledger_size + ', open_ledger_fee: ' + fee.drops.open_ledger_fee + ', hostID: ' + info.hostID)
        const processUptime = process.uptime()
        const osUptime = os.uptime()
        res.send({
          faucetVersion: '0.0.2',
          processUptime,
          processUptimeHhMmSs: format(processUptime),
          osUptime,
          osUptimeHhMmSs: format(osUptime),
          balance: account.account_data.Balance,
          rippled: info,
          fee
        })
      })
    })
  }).catch(e => {
    console.log('/info error:', e)
    // [DisconnectedError(websocket was closed)]
    res.status(500).send({
      error: 'Server load is too high. Request info later'
    })
    nextAvailableSeq = null
    resetRippleAPI('info')
  })
})

function format(seconds){
  function pad(s){
    return (s < 10 ? '0' : '') + s;
  }
  var hours = Math.floor(seconds / (60*60));
  var minutes = Math.floor(seconds % (60*60) / 60);
  var seconds = Math.floor(seconds % 60);

  return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

app.get('/status', (req, res) => {
  createRippleAPI()
  api.connect().then(() => {
    return api.getServerInfo()
  }).then(info => {
    checkForWarning(info)

    return api.request('fee').then(fee => {
      checkForWarning(fee)

      console.log('Returning /status - ledgerVersion: ' + info.validatedLedger.ledgerVersion + ', age: ' + info.validatedLedger.age + ', expected_ledger_size: ' + fee.expected_ledger_size + ', open_ledger_fee: ' + fee.drops.open_ledger_fee + ', hostID: ' + info.hostID)
      const processUptime = process.uptime()

// broken - showing 0
// Since startup, I have received *${txRequestCount} requests* and sent *${txCount} transactions*.

      const text = `*XRP Test Net Faucet:* https://xrpl.org/xrp-testnet-faucet.html
*Uptime:* ${format(processUptime)}
*rippled* buildVersion: ${info.buildVersion}
> completeLedgers: ${info.completeLedgers}
> loadFactor: ${info.loadFactor}
> peers: ${info.peers}
> serverState: ${info.serverState}
> validatedLedger.ledgerVersion: ${info.validatedLedger.ledgerVersion}
> hostID: ${info.hostID}
> open_ledger_fee: ${fee.drops.open_ledger_fee} drops
> expected_ledger_size: ${fee.expected_ledger_size}
Full info: https://faucet.altnet.rippletest.net/info`
      res.send({
    "response_type": "in_channel",
    "text": text
})
    })
  }).catch(e => {
    console.log('/status error:', e)
    // [DisconnectedError(websocket was closed)]
    res.status(500).send({
      error: 'Server load is too high. Request status later'
    })
    nextAvailableSeq = null
    resetRippleAPI('info')
  })
})

const server = app.listen(port, () => console.log(`Altnet faucet, node version: ${process.version}, listening on port: ${port}`))
server.setTimeout(20 * 1000)

// Report TPS every minute
let peak = 0
let peakRequests = 0
setInterval(() => {
  if (txCount > peak) {
    peak = txCount
  }
  if (txRequestCount > peakRequests) {
    peakRequests = txRequestCount
  }
  console.log(`[TPS] success=${txCount}, tps=${(txCount / 60).toFixed(1)}, peak=${peak}, requests=${txRequestCount}, rps=${(txRequestCount / 60).toFixed(1)}, peakRequests=${peakRequests}, success%=${((txCount / txRequestCount) * 100).toFixed(1)}%, success_peak/request_peak=${((peak / peakRequests) * 100).toFixed(1)}%`)
  txCount = 0
  txRequestCount = 0
}, 60 * 1000)