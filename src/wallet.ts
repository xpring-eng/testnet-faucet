import { Wallet } from 'xrpl';
import { config } from './config';

export const fundingWallet = Wallet.fromSecret(config.FUNDING_SECRET)
