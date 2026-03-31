import { z } from "zod";
import { sberGet } from "../client.js";

export const getAccountsSchema = z.object({});

export async function handleGetAccounts(): Promise<string> {
  const result = await sberGet("/fintech/v1/accounts");
  return JSON.stringify(result, null, 2);
}

export const getStatementSchema = z.object({
  account_id: z.string().describe("ID счёта"),
  date_from: z.string().optional().describe("Дата начала (YYYY-MM-DD)"),
  date_to: z.string().optional().describe("Дата окончания (YYYY-MM-DD)"),
});

export async function handleGetStatement(params: z.infer<typeof getStatementSchema>): Promise<string> {
  const query = new URLSearchParams();
  query.set("accountId", params.account_id);
  if (params.date_from) query.set("dateFrom", params.date_from);
  if (params.date_to) query.set("dateTo", params.date_to);

  const result = await sberGet(`/fintech/v1/statement?${query.toString()}`);
  return JSON.stringify(result, null, 2);
}
