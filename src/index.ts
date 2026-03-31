#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";

import {
  getAccountsSchema,
  handleGetAccounts,
  getBalanceSchema,
  handleGetBalance,
} from "./tools/accounts.js";
import {
  getStatementSchema,
  handleGetStatement,
} from "./tools/transactions.js";
import {
  createPaymentSchema,
  handleCreatePayment,
  getPaymentStatusSchema,
  handleGetPaymentStatus,
} from "./tools/payments.js";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "sber-mcp",
    version: "1.1.0",
  });

  // 1. get_accounts
  server.tool(
    "get_accounts",
    "Список счетов клиента в Сбербанке.",
    getAccountsSchema.shape,
    async () => ({
      content: [{ type: "text", text: await handleGetAccounts() }],
    }),
  );

  // 2. get_balance
  server.tool(
    "get_balance",
    "Баланс по счёту.",
    getBalanceSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetBalance(params) }],
    }),
  );

  // 3. get_statement (transactions)
  server.tool(
    "get_statement",
    "Выписка по счёту за период (список транзакций).",
    getStatementSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetStatement(params) }],
    }),
  );

  // 4. create_payment
  server.tool(
    "create_payment",
    "Создание платёжного поручения.",
    createPaymentSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreatePayment(params) }],
    }),
  );

  // 5. get_payment_status
  server.tool(
    "get_payment_status",
    "Статус платежа по ID.",
    getPaymentStatusSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetPaymentStatus(params) }],
    }),
  );

  return server;
}

export { createMcpServer };

async function main() {
  const mode = process.argv[2];

  if (mode === "--http") {
    const port = parseInt(process.env.PORT || "3000", 10);
    const httpServer = createServer(async (req, res) => {
      if (req.url === "/mcp" || req.url === "/mcp/") {
        const server = createMcpServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.setHeader("Content-Type", "application/json");
        await server.connect(transport);
        await transport.handleRequest(req, res);
      } else if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", tools: 5 }));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    httpServer.listen(port, () => {
      console.error(`[sber-mcp] HTTP mode on :${port}/mcp (5 tools)`);
    });
  } else {
    // Default: stdio
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[sber-mcp] Stdio mode. 5 tools. Auth: SBER_TOKEN or SBER_CLIENT_ID+SECRET.");
  }
}

main().catch((error) => {
  console.error("[sber-mcp] Ошибка:", error);
  process.exit(1);
});
