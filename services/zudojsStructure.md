# Zudojs structure for every backend stack

Every backend (Go, TypeScript, Elixir, Python) uses the Zudojs layout that `apps/api` already follows. A developer who knows one service can find their way around any other.

## Service layout

```
<serviceName>/
├── src/                      (Go: the module root; Elixir: lib/<app>/; Python: src/)
│   ├── app.<ext>             app wiring
│   ├── server.<ext>          process entry / HTTP server
│   ├── container.<ext>       dependency container
│   ├── configs/              <name>.config.<ext>
│   ├── constants/            <name>.constant.<ext>
│   ├── databases/            <name>.database.<ext>
│   ├── enums/                <name>.enum.<ext>
│   ├── errors/               <name>.error.<ext>
│   ├── events/               shared event bus/outbox wiring
│   ├── integrations/         <provider>.integration.<ext>  (paystack, livekit, rabbitmq, …)
│   ├── interfaces/           <name>.interface.<ext>
│   ├── jobs/                 <name>.job.<ext>
│   ├── loaders/              <name>.loader.<ext>
│   ├── loggers/              <name>.logger.<ext>
│   ├── middlewares/          <name>.middleware.<ext>
│   ├── repositories/         shared repository bases
│   ├── routes/               <name>.routes.<ext>
│   ├── types/                <name>.type.<ext>
│   ├── utils/                <name>.util.<ext>
│   └── modules/
│       └── <moduleName>/
│           ├── <moduleName>.module.<ext>
│           ├── commands/<commandName>/<commandName>.command.<ext> + <commandName>.handler.<ext>
│           ├── queries/<queryName>/<queryName>.query.<ext> + <queryName>.handler.<ext>
│           ├── controllers/<moduleName>.controller.<ext>
│           ├── services/<name>.service.<ext>
│           ├── repositories/<name>.repository.<ext>
│           ├── validators/<name>.validator.<ext>
│           ├── dtos/<name>.dto.<ext>
│           ├── models/<name>.model.<ext>
│           ├── events/<eventName>.event.<ext>
│           └── routes/<moduleName>.routes.<ext>
└── tests/                    mirrors src/
```

Only create the folders a service actually needs.

## Naming rules

- File names are `<name>.<kind>.<ext>`.
- Multi-word names are camelCase, never kebab-case or snake_case: `verifyOtp.command.go`, `chargeGiftAndCreditCreator.handler.go`, `domainEvent.router.ex`. This applies to folders too: `commands/verifyOtp/`, `deployables/goMoney/`.
- Function and type names are long and self-explanatory: `RotateRefreshTokenAndDetectReuse`, `calculateSellerGroupShippingInMinorUnits`.
- Almost no comments. Every file is 300 lines or fewer.

## Per-language constraints

| Stack | Rule |
| --- | --- |
| TypeScript (Zudojs) | Exactly as above. Barrels stay `index.ts`. |
| Go | As above. Each folder is a package, and the package name is the lowercased folder name (`commands/verifyOtp` → `package verifyotp`). Tests are `<name>.<kind>_test.go`, because Go requires the `_test.go` suffix. ent's generated code lives in `src/generated/ent/`, like `apps/api/src/generated`. |
| Elixir (Phoenix) | `lib/realtime/` follows the layout with camelCase file names (`clientSocket.socket.ex`, `topic.authorizer.ex`). Module names stay idiomatic (`Realtime.Topics.TopicAuthorizer`). Tests are `<name>.<kind>_test.exs`. |
| Python | Same folders and kinds, but file names must be importable, so they use snake_case with the kind as a suffix: `verify_otp_command.py`, `feed_ranking_service.py`. This is the one allowed exception, already used in `services/python/intelligence`. |

Tool-generated files keep the tool's names: Atlas migrations, `atlas.sum`, `go.mod`, `mix.exs`, `pyproject.toml`, Dockerfiles, and buf output.
