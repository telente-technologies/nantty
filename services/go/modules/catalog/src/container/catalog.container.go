package container

import (
	"database/sql"
	"log/slog"
	"time"

	"zudomart/modules/catalog/src/configs"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/usersdirectory"
	"zudomart/platform/viewerregion"
)

type Container struct {
	Client           *ent.Client
	Database         *sql.DB
	Users            usersdirectory.Reader
	Rates            *viewerregion.RateReader
	Settings         configs.CatalogSettings
	Logger           *slog.Logger
	Now              func() time.Time
	AccessVerifier   *jwtauth.AccessTokenVerifier
	IdempotencyStore *idempotency.RedisStore
}
