import { Wallet } from 'xrpl';

const address = process.env['FUNDING_ADDRESS']
const secret = process.env['FUNDING_SECRET']

export const fundingWallet = Wallet.fromSecret(secret)

if(address !== fundingWallet.address) {
  throw Error('Wallet secret and address an incompatible')
}
