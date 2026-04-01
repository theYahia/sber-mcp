/**
 * Skill: skill-balance
 * Quick balance check — returns formatted account balance.
 * Usage: /skill-balance <account_id>
 */
import { sberFetch } from "../client.js";

interface BalanceResult {
  accountId: string;
  amount: number;
  currency: string;
  formatted: string;
}

export async function skillBalance(accountId: string): Promise<BalanceResult> {
  const data = (await sberFetch(`/fintech/v1/accounts/${accountId}/balance`)) as {
    amount: number;
    currency: string;
  };

  const formatted = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: data.currency || "RUB",
  }).format(data.amount);

  return {
    accountId,
    amount: data.amount,
    currency: data.currency,
    formatted,
  };
}
