const os = require('os')
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env['PORT']
const RippleAPI = require('ripple-lib').RippleAPI

const rippledUri = process.env['RIPPLED_URI']
const address = process.env['FUNDING_ADDRESS']
const secret = process.env['FUNDING_SECRET']
const amount = process.env['XRP_AMOUNT']

app.use(cors())

let stats = {}
let grandTotalTxs = 0
let grandTotalRequests = 0
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
  grandTotalRequests++

  const reqId = (Math.random() + 1).toString(36).substr(2, 5)
  // const reqId = req.ip + req.secure ? ' s' : ' u'

  createRippleAPI()
  const account = api.generateAddress()
  console.log(`${reqId}| Generated new account: ${account.address}`)

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
    }, {maxLedgerVersionOffset: 5, sequence})
  }).then(prepared => {
    checkForWarning(prepared)

    const {signedTransaction} = api.sign(prepared.txJSON, secret)
    return api.submit(signedTransaction)
  }).then((result) => {
    checkForWarning(result)

    if (result.engine_result === 'tesSUCCESS' || result.engine_result === 'terQUEUED' || result.engine_result === 'terPRE_SEQ') {
      console.log(`${reqId}| Funded ${account.address} with ${amount} XRP (${result.engine_result})`)
      res.send({
        account,
        balance: Number(amount)
      })
      txCount++
      grandTotalTxs++
    } else if (result.engine_result === 'tefPAST_SEQ') {
      // occurs when we re-connect to a different rippled server
      console.log(`${reqId}| Failed to fund ${account.address} with ${amount} XRP (${result.engine_result})`)
      res.status(503).send({
        error: 'Failed to fund account. Try again later',
        account
      })

      // advance cached sequence if needed:
      getSequenceFromAccountInfo({reqId, shouldAdvanceSequence: false})
    } else {
      console.log(`${reqId}| Unrecognized failure to fund ${account.address} with ${amount} XRP (${result.engine_result})`)
      console.log(result)
      res.status(503).send({
        error: 'Failed to fund account',
        account
      })
      // TODO: Look for this in the logs
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
      if (options.shouldAdvanceSequence === true) {
        sequence = nextAvailableSeq
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

      console.log('Returning /info - ledgerVersion: ' + info.validatedLedger.ledgerVersion + ', age: ' + info.validatedLedger.age + ', expected_ledger_size: ' + fee.expected_ledger_size + ', open_ledger_fee: ' + fee.drops.open_ledger_fee + ', hostID: ' + info.hostID)
      const processUptime = process.uptime()
      const osUptime = os.uptime()
      res.send({
        processUptime,
        processUptimeHhMmSs: format(processUptime),
        osUptime,
        osUptimeHhMmSs: format(osUptime),
        rippled: info,
        fee,
        stats: Object.assign({}, stats, {grandTotalTxs, grandTotalRequests})
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
      const osUptime = os.uptime()
      const text = `*XRP Test Net Faucet:* https://developers.ripple.com/xrp-test-net-faucet.html
*Uptime:* ${format(processUptime)}
Since startup, I have received *${grandTotalRequests} requests* and sent *${grandTotalTxs} transactions*.
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
  stats.txCount = txCount
  stats.tps = (txCount / 60).toFixed(1)
  stats.peak = peak
  stats.requests = txRequestCount
  stats.requests_per_sec = (txRequestCount / 60).toFixed(1)
  stats.peakRequests = peakRequests
  stats.success_pct = ((txCount / txRequestCount) * 100).toFixed(1)
  stats.success_peak_divby_request_peak_pct = ((peak / peakRequests) * 100).toFixed(1)
  console.log(stats)
  txCount = 0
  txRequestCount = 0
}, 60 * 1000)
