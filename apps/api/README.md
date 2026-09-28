# zudomart

A modular monolith built with the Zudojs framework.

## Architecture

This project uses a **modular monolith** architecture.

Modules:

- **auth**
- **users**
- **stores**
- **categories**
- **products**
- **carts**
- **orders**
- **payments**
- **escrows**
- **wallets**
- **posts**
- **feeds**
- **follows**
- **reviews**
- **notifications**
- **messages**
- **search**
- **media**
- **waitlist**

Each module owns `src/modules/<name>/routes/index.ts`, registered from
`src/routes/index.ts`. Add a resource to a module with:

```bash
npx zudojs generate resource invoices --module <name>
```

## Getting Started

```bash
cp .env.example .env
pnpm run dev
```

## License

MIT
