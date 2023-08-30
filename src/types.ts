export interface Account {
  xAddress: string;
  classicAddress: string;
  address: string;
  tag?: number | boolean;
}
export interface FundedResponse {
  account: Account;
  amount: number;
  seed?: string;
}
