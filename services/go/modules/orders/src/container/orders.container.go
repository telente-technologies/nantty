package container

import (
	"database/sql"
	"log/slog"
	"time"

	"nantty/modules/orders/src/configs"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/interfaces"
	"nantty/modules/orders/src/logistics"
	"nantty/platform/commerceports"
	"nantty/platform/idempotency"
	"nantty/platform/jwtauth"
	"nantty/platform/staffaudit"
	"nantty/platform/usersdirectory"
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
