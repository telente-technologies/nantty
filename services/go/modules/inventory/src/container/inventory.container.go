package container

import (
	"database/sql"
	"log/slog"
	"time"

	"nantty/modules/inventory/src/configs"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/platform/idempotency"
	"nantty/platform/jwtauth"
	"nantty/platform/usersdirectory"
)

type Container struct {
	Client           *ent.Client
	Database         *sql.DB
	Users            usersdirectory.Reader
	Settings         configs.InventorySettings
	Logger           *slog.Logger
	Now              func() time.Time
	AccessVerifier   *jwtauth.AccessTokenVerifier
	IdempotencyStore *idempotency.RedisStore
}
