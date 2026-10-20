package container

import (
	"database/sql"
	"log/slog"
	"time"

	"zudomart/modules/orders/src/configs"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/interfaces"
	"zudomart/modules/orders/src/logistics"
	"zudomart/platform/commerceports"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffaudit"
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
	Staff            StaffVerifiers
	Audit            staffaudit.Recorder
	Logistics        *logistics.Registry
}

type StaffVerifiers struct {
	Access *jwtauth.AccessTokenVerifier
	StepUp *jwtauth.AccessTokenVerifier
}

func (container *Container) Catalog() (commerceports.CatalogReader, error) {
	return commerceports.Default.CatalogReader()
}

func (container *Container) Stock() (commerceports.InventoryStock, error) {
	return commerceports.Default.InventoryStock()
}
