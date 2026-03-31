# @theyahia/sber-mcp

MCP-сервер для API Сбербанка — счета и выписки.

## Инструменты

| Инструмент | Описание |
|---|---|
| `get_accounts` | Список счетов клиента |
| `get_statement` | Выписка по счёту за период |

## Настройка

```json
{
  "mcpServers": {
    "sber": {
      "command": "npx",
      "args": ["-y", "@theyahia/sber-mcp"],
      "env": {
        "SBER_ACCESS_TOKEN": "ваш_токен"
      }
    }
  }
}
```

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `SBER_ACCESS_TOKEN` | Да | Bearer-токен для API Сбербанка |

## Лицензия

MIT
