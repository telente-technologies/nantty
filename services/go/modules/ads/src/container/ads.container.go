package container

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"zudomart/modules/ads/src/configs"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/interfaces"
	"zudomart/modules/ads/src/services"
	platformevents "zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffaudit"
)

type QueueConsumer = platformevents.QueueConsumer

type Container struct {
	Client           *ent.Client
	Database         *sql.DB
	Settings         configs.AdsSettings
	Logger           *slog.Logger
	Now              func() time.Time
	AccessVerifier   *jwtauth.AccessTokenVerifier
	StaffVerifier    *jwtauth.AccessTokenVerifier
	IdempotencyStore *idempotency.RedisStore
	Counters         interfaces.CounterStore
	Frequency        services.FrequencyGuard
	Spend            services.SpendCounters
	Signer           services.AdTokenSigner
	Policies         *services.PolicySource
	Pricing          *services.RegionalAdPricing
	Candidates       *services.CandidateIndex
	Consent          interfaces.ConsentReader
	Signals          interfaces.ContentSignalReader
	Pctr             interfaces.PctrScorer
	FraudModel       interfaces.FraudModelScorer
	Funding          interfaces.FundingGateway
	Users            interfaces.UserDirectory
	Stores           interfaces.StoreDirectory
	AudienceSource   interfaces.AudienceMemberSource
	Identity         interfaces.IdentityMatcher
	ContentSources   interfaces.ContentSourceDirectory
	Ownership        interfaces.DestinationOwnership
	Storage          interfaces.ObjectStorage
	TopUps           interfaces.TopUpGateway
	AuditHistory     interfaces.AuditHistoryReader
	UserSummaries    interfaces.PlatformUserSummaries
	Verification     interfaces.VerificationReader
	Entitlements     interfaces.EntitlementReader
	EarningsFunding  interfaces.EarningsFunding
	Audit            staffaudit.Recorder
	Jobs             platformevents.JobQueue
	QueueConsumer    QueueConsumer
}

func (container *Container) RunInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	tx, err := container.Client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	if err := work(tx); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
