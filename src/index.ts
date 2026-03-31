#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAccountsSchema, handleGetAccounts, getStatementSchema, handleGetStatement } from "./tools/accounts.js";

const server = new McpServer({
  name: "sber-mcp",
  version: "1.0.0",
});

server.tool(
  "get_accounts",
  "Список счетов клиента в Сбербанке.",
  getAccountsSchema.shape,
  async () => ({ content: [{ type: "text", text: await handleGetAccounts() }] }),
);

server.tool(
  "get_statement",
  "Выписка по счёту за период.",
  getStatementSchema.shape,
  async (params) => ({ content: [{ type: "text", text: await handleGetStatement(params) }] }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[sber-mcp] Сервер запущен. 2 инструмента. Требуется SBER_ACCESS_TOKEN.");
}

main().catch((error) => {
  console.error("[sber-mcp] Ошибка:", error);
  process.exit(1);
});
