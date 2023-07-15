import express from 'express';
import rTracer from 'cls-rtracer'
import cors from 'cors'

import accounts from './routes/accounts';
import { config } from './config';

const app = express()
app.use(cors())
app.use(express.json())
app.use(rTracer.expressMiddleware())
app.post('/accounts', accounts)

const server = app.listen(config.PORT, () => {
  console.log(`Faucet, node version: ${process.version}, listening on port: ${config.PORT}`)
})
server.setTimeout(20 * 1000)
