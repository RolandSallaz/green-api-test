# Green-API MAX Chat — тестовое Frontend React

Live: https://rolandsallaz.github.io/green-api-test/
Repo: https://github.com/RolandSallaz/green-api-test

Минимальный чат для отправки/получения текстовых сообщений через GREEN-API MAX.
Прототип: https://web.max.ru/

## Стек
React 19 + TypeScript + Vite, только `fetch`, без UI-библиотек.

## Функции по ТЗ
- Ввод `idInstance`, `apiTokenInstance`, `apiUrl` (default `https://api.green-api.com`)
- Ввод телефона → `chatId = телефон@c.us` → создание чата
- Отправка текста: `POST /waInstance{id}/sendMessage/{token}` (`SendMessage`)
- Получение: `GET /receiveNotification` + `DELETE /deleteNotification` каждые 5с (HTTP API)
- Только текстовые сообщения (`textMessage` / `extendedTextMessage`)

## Локальный запуск
```bash
cd green-api-test
npm install
npm run dev
# открыть http://localhost:5173
```

## Сборка
```bash
npm run build
npm run preview
```

## Как проверить без реального MAX
1. Получить `idInstance`/`apiToken` в https://console.green-api.com (тариф Developer, инстанс MAX).
2. Включить получение уведомлений (SetSettings: `incomingWebhook: yes`, `webhookUrl: ""`) или в кабинете.
3. Ввести креды в шапке → Войти → ввести телефон → + Чат → писать → собеседник отвечает в MAX → ответ появится за ~5с.

Без инстанса UI проверяется: создание чатов, optimistic-отправка (увидите ошибку SendMessage в логе — это нормально).

## Структура
- `src/greenApi.ts` — SendMessage / Receive / Delete / normalizeChatId
- `src/App.tsx` — логин, список чатов, сообщения, polling
- `src/App.css` — минимал под web.max.ru
