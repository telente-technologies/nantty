package container

import (
	"database/sql"
	"log/slog"
	"time"

	"zudomart/modules/inventory/src/configs"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/usersdirectory"
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
