# RestoPulse web (React 19 + TypeScript + Vite)

    npm install
    npm run dev                                          # in-memory mock, no backend needed
    VITE_API_URL=https://api.example.com npm run dev     # real API: REST /api/v1 + Socket.IO /orders

Rules built in:
- Money is integer XAF. The server prices orders; the client sends ids and quantities only.
- One Idempotency-Key per cart, reused on retry, so timeouts cannot duplicate orders.
- Status changes carry the order `version`. A 409 triggers a refetch of the real state.
- Socket events only invalidate queries. Polling and focus refetch cover silent socket drops.
- The UI talks to the `ApiClient` interface only (src/api/client.ts).

Not done yet: auth and permissions, order sheet, bills and payments, cashier, admin, customer app, PWA plugin, tests.
