import express from "express";
import rTracer from "cls-rtracer";
import cors from "cors";

import accounts from "./routes/accounts";
import { config } from "./config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(rTracer.expressMiddleware());
app.post("/accounts", accounts);

const server = app.listen(config.PORT, () => {
  console.log(
    `Faucet, node version: ${process.version}, listening on port: ${config.PORT}`
  );
});
server.setTimeout(20 * 1000);

// In your index.js or wherever txCount is defined
export let txCount = 0;
export let txRequestCount = 0;
export function incrementTxCount() {
  txCount += 1;
}
export function incrementTxRequestCount() {
  txRequestCount += 1;
}

// Report TPS every minute
let peak = 0;
let peakRequests = 0;
setInterval(() => {
  if (txCount > peak) {
    peak = txCount;
  }
  if (txRequestCount > peakRequests) {
    peakRequests = txRequestCount;
  }
  console.log(
    `[TPS] success=${txCount}, tps=${(txCount / 60).toFixed(
      1
    )}, peak=${peak}, requests=${txRequestCount}, rps=${(
      txRequestCount / 60
    ).toFixed(1)}, peakRequests=${peakRequests}, success%=${(
      (txCount / txRequestCount) *
      100
    ).toFixed(1)}%, success_peak/request_peak=${(
      (peak / peakRequests) *
      100
    ).toFixed(1)}%`
  );
  txCount = 0;
  txRequestCount = 0;
}, 60 * 1000);
