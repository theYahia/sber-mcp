/**
 * Skill: skill-transactions
 * Transaction summary — totals, top categories, date range.
 * Usage: /skill-transactions <account_id> [date_from] [date_to]
 */
import { sberFetch } from "../client.js";
import type { StatementResponse, Transaction } from "../types.js";

interface TransactionSummary {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  count: number;
  totalIncome: number;
  totalExpense: number;
  net: number;
  currency: string;
  transactions: Transaction[];
}

export async function skillTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<TransactionSummary> {
  const query = new URLSearchParams();
  query.set("accountId", accountId);
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);

  const data = (await sberFetch(
    `/fintech/v1/statement?${query.toString()}`,
  )) as StatementResponse;

  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of data.transactions) {
    if (tx.amount >= 0) totalIncome += tx.amount;
    else totalExpense += Math.abs(tx.amount);
  }

  return {
    accountId: data.account,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    count: data.transactions.length,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    currency: data.transactions[0]?.currency || "RUB",
    transactions: data.transactions,
  };
}
