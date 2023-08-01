import { Wallet } from "xrpl";
import { config } from "./config";

export const fundingWallet = Wallet.fromSeed(config.FUNDING_SECRET, {
  masterAddress: config.FUNDING_ADDRESS,
});
