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
- **audit**
- **currency**

Each module owns `src/modules/<name>/routes/index.ts`, registered from
`src/routes/index.ts`. Add a resource to a module with:

```bash
npx zudojs generate resource invoices --module <name>
```

## Getting Started

```bash
cp .env.example .env
docker compose up -d postgres redis mailpit
pnpm db:migrate:deploy
pnpm db:seed
pnpm run dev
```

## Database

PostgreSQL through Prisma 7. The schema is split per module in `prisma/schema/*.prisma`.

- `pnpm db:migrate:dev --name <change>`: create a migration from schema changes (Prisma writes the SQL; never edit it by hand) and apply it locally.
- `pnpm db:migrate:deploy`: apply pending migrations. Production runs this before the server starts (the Docker image does it in its start command).
- `pnpm db:push`: quick local prototyping without a migration.
- `pnpm db:generate`, `pnpm db:validate`, `pnpm db:seed`.

## License

MIT
