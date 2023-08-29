export interface Account {
  xAddress: string;
  classicAddress: string;
  address: string;
  tag?: number | boolean;
}
export interface ResponseType {
  account: Account;
  amount: string;
  seed?: string;
}
