#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

import { getAccountsSchema, handleGetAccounts, getBalanceSchema, handleGetBalance } from "./tools/accounts.js";
import {
  getStatementSchema,
  handleGetStatement,
  summarizeTransactionsSchema,
  handleSummarizeTransactions,
} from "./tools/transactions.js";
import {
  createPaymentSchema,
  handleCreatePayment,
  getPaymentStatusSchema,
  handleGetPaymentStatus,
} from "./tools/payments.js";
import { handleListCounterparties } from "./tools/counterparties.js";
import { handleGetCompanyInfo } from "./tools/company.js";

// Версия — single source of truth из package.json (работает и в dev через tsx, и в собранном dist).
export const VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

export const TOOL_COUNT = 8;

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "sber-mcp", version: VERSION });

  // === Счета ===

  server.registerTool(
    "get_accounts",
    {
      description: "Список счетов клиента в Сбербанке.",
      inputSchema: getAccountsSchema.shape,
      annotations: { title: "Список счетов", readOnlyHint: true },
    },
    async () => ({ content: [{ type: "text", text: await handleGetAccounts() }] }),
  );

  server.registerTool(
    "get_balance",
    {
      description: "Баланс по счёту.",
      inputSchema: getBalanceSchema.shape,
      annotations: { title: "Баланс счёта", readOnlyHint: true },
    },
    async (params) => ({ content: [{ type: "text", text: await handleGetBalance(params) }] }),
  );

  // === Выписки ===

  server.registerTool(
    "get_statement",
    {
      description: "Выписка по счёту за период (список транзакций). Поддерживает пагинацию.",
      inputSchema: getStatementSchema.shape,
      annotations: { title: "Выписка по счёту", readOnlyHint: true },
    },
    async (params) => ({ content: [{ type: "text", text: await handleGetStatement(params) }] }),
  );

  server.registerTool(
    "summarize_transactions",
    {
      description:
        "Сводка по выписке: количество, суммы поступлений/списаний, чистый итог за период.",
      inputSchema: summarizeTransactionsSchema.shape,
      annotations: { title: "Сводка по транзакциям", readOnlyHint: true },
    },
    async (params) => ({
      content: [{ type: "text", text: await handleSummarizeTransactions(params) }],
    }),
  );

  // === Платежи ===

  server.registerTool(
    "create_payment",
    {
      description:
        "Создание платёжного поручения. Денежная операция: идемпотентна по RqUID " +
        "(повтор с тем же ключом не создаёт дубль).",
      inputSchema: createPaymentSchema.shape,
      annotations: {
        title: "Создать платёж",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (params) => ({ content: [{ type: "text", text: await handleCreatePayment(params) }] }),
  );

  server.registerTool(
    "get_payment_status",
    {
      description: "Статус платежа по ID.",
      inputSchema: getPaymentStatusSchema.shape,
      annotations: { title: "Статус платежа", readOnlyHint: true },
    },
    async (params) => ({
      content: [{ type: "text", text: await handleGetPaymentStatus(params) }],
    }),
  );

  // === Контрагенты / Организация ===

  server.registerTool(
    "list_counterparties",
    {
      description: "Список сохранённых контрагентов (получателей платежей).",
      annotations: { title: "Контрагенты", readOnlyHint: true },
    },
    async () => ({ content: [{ type: "text", text: await handleListCounterparties() }] }),
  );

  server.registerTool(
    "get_company_info",
    {
      description: "Сведения об организации-клиенте (реквизиты, ИНН, список счетов).",
      annotations: { title: "Об организации", readOnlyHint: true },
    },
    async () => ({ content: [{ type: "text", text: await handleGetCompanyInfo() }] }),
  );

  return server;
}

async function startHttpServer(port: number): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "sber-mcp", version: VERSION, tools: TOOL_COUNT }));
      return;
    }

    if (req.url === "/mcp" || req.url === "/mcp/") {
      // Stateless: свежий сервер + транспорт на запрос, с гарантированной очисткой по завершении.
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error("[sber-mcp] Ошибка обработки HTTP-запроса:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "internal_error" }));
        }
      }
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    console.error(`[sber-mcp] HTTP-режим на порту ${port} (${TOOL_COUNT} инструментов)`);
    console.error(`[sber-mcp] MCP: http://localhost:${port}/mcp`);
    console.error(`[sber-mcp] Health: http://localhost:${port}/health`);
  });
}

async function main() {
  const httpMode = process.argv.includes("--http");

  if (httpMode) {
    const port = parseInt(process.env.PORT || "3000", 10);
    await startHttpServer(port);
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      `[sber-mcp] Stdio-режим. ${TOOL_COUNT} инструментов. Auth: SBER_TOKEN или SBER_CLIENT_ID+SECRET.`,
    );
  }
}

main().catch((error) => {
  console.error("[sber-mcp] Ошибка:", error);
  process.exit(1);
});
