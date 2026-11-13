# Run the backend in Docker Compose

The root `compose.yml` combines the local infrastructure with every backend deployable: six Go binaries, six TypeScript services, Python intelligence, and Elixir realtime. It also runs one-shot migration containers for Go Money and the five Prisma services before their runtime containers start.

This is a local-development stack, not a production deployment. The app containers use Linux host networking because the checked-in development environment files address infrastructure and peer services through `127.0.0.1`. Docker Engine on Linux is required; Docker Desktop host-network behavior differs. App listeners bind to loopback and are intended for this machine only.

Start everything:

```bash
docker compose -f compose.yml up --build -d
```

Inspect status and logs:

```bash
docker compose -f compose.yml ps -a
docker compose -f compose.yml logs -f gateway
```

The gateway is at `http://127.0.0.1:8080`; supporting service ports and demo setup are documented in [services/README.md](../services/README.md) and [docs/runningLocally.md](runningLocally.md). The Compose stack uses the repository's local-only credentials and does not configure real Flutterwave, Apple/Google billing, production email, or public TLS.

Stop containers while preserving local database and broker data:

```bash
docker compose -f compose.yml down
```

`docker compose down -v` also deletes the named data volumes; only use it when you intentionally want to reset local data.

The React Native, iOS, and Android clients are not server processes and are not started by this backend Compose file. iOS builds require macOS/Xcode; Android builds remain available through the native Android Gradle project.
