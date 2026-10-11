package container

import (
	"database/sql"
	"log/slog"
	"time"

	"zudomart/modules/catalog/src/configs"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/interfaces"
	platformevents "zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/viewerregion"
)

type Container struct {
	Client           *ent.Client
	Database         *sql.DB
	Users            interfaces.UserDirectory
	Rates            *viewerregion.RateReader
	Settings         configs.CatalogSettings
	Logger           *slog.Logger
	Now              func() time.Time
	AccessVerifier   *jwtauth.AccessTokenVerifier
	IdempotencyStore *idempotency.RedisStore
	Jobs             platformevents.JobQueue
	Staff            StaffVerifiers
	Audit            interfaces.AuditTrail
	Identity         interfaces.IdentityDirectory
	PrivateMedia     interfaces.PrivateMediaSigner
	StoreFollows     interfaces.StoreFollowStats
	MartAds          interfaces.MartAdDecider
	LinkedProfiles   interfaces.LinkedProfileRegistry
}

type StaffVerifiers struct {
	Access *jwtauth.AccessTokenVerifier
	StepUp *jwtauth.AccessTokenVerifier
}
