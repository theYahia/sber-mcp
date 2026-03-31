export interface Account {
  id: string;
  number: string;
  currency: string;
  balance: number;
  name?: string;
  state?: string;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description?: string;
  counterparty?: string;
  type: string;
}

export interface StatementResponse {
  transactions: Transaction[];
  account: string;
  dateFrom: string;
  dateTo: string;
}
