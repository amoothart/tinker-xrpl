    # Project: XRPL Application

## Stack
- TypeScript (strict), ESM, Node 24
- xrpl.js v5 — see https://js.xrpl.org for API reference
- Run scripts with `tsx`, e.g. `npm run connect`

## Network
- Testnet only: wss://s.altnet.rippletest.net:51233
- Never write code that points at Mainnet without an explicit instruction from me.

## Conventions
- Amounts: always convert with xrpToDrops/dropsToXrp. Never hardcode drop values.
- Never commit seeds, secrets, or .env. Load credentials from environment variables.
- Every transaction submission must check the result code and handle tec/tem/ter failures.
- Prefer client.autofill() over manually setting Fee, Sequence, LastLedgerSequence.

## Docs
- Concepts and transaction types: https://xrpl.org/docs
- Library reference: https://js.xrpl.org
