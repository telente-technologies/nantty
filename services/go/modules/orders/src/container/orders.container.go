package container

import (
	"database/sql"
	"log/slog"
	"time"

	"zudomart/modules/orders/src/configs"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/interfaces"
	"zudomart/platform/commerceports"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/usersdirectory"
)

type Container struct {
	Client           *ent.Client
	Database         *sql.DB
	Users            usersdirectory.Reader
	Settings         configs.OrdersSettings
	Logger           *slog.Logger
	Now              func() time.Time
	AccessVerifier   *jwtauth.AccessTokenVerifier
	IdempotencyStore *idempotency.RedisStore
	Money            interfaces.CheckoutMoney
}

func (container *Container) Catalog() (commerceports.CatalogReader, error) {
	return commerceports.Default.CatalogReader()
}

func (container *Container) Stock() (commerceports.InventoryStock, error) {
	return commerceports.Default.InventoryStock()
}
