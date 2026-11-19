package container

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/configs"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/integrations"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
)

type Container struct {
	Client             *ent.Client
	Database           *sql.DB
	Settings           configs.UsersSettings
	Logger             *slog.Logger
	Now                func() time.Time
	AccessVerifier     *jwtauth.AccessTokenVerifier
	PendingWithdrawals PendingWithdrawalChecker
	ActivityCounts     ActivityCountSource
	IdentityCapture    IdentityCaptureProvider
	Eligibility        VerificationEligibilityAssessor
	PlatformSettings   *identityports.CachedPlatformSettings
	OwnedStores        OwnedStoreLookup
	Catalog            CatalogEntities
}

type CatalogEntities interface {
	FindBrands(ctx context.Context, ownerAccountId *uuid.UUID, brandIds []uuid.UUID) ([]integrations.CatalogBrand, error)
	FindStoresOfAccounts(ctx context.Context, accountIds []uuid.UUID) ([]integrations.CatalogStore, error)
	FindPendingSellerApplications(ctx context.Context) ([]integrations.CatalogPendingApplication, error)
}

type OwnedStoreLookup interface {
	FindOwnedStoreId(ctx context.Context, accountId uuid.UUID) (*string, error)
}

type IdentityCaptureProvider interface {
	CreateWebToken(ctx context.Context, capture integrations.SmileIdCaptureRequest) (string, error)
	CreateSmileLink(ctx context.Context, capture integrations.SmileIdCaptureRequest) (string, error)
	SupportedDocuments(ctx context.Context, country string) ([]integrations.SmileIdDocumentCountry, error)
	SupportedKycTypes(ctx context.Context, country string) ([]integrations.SmileIdSupportedKycType, error)
	EnhancedDocumentEntitlements(ctx context.Context) (map[string][]string, error)
}

type VerificationEligibilityAssessor interface {
	AssessVerificationEligibility(ctx context.Context, signals integrations.EligibilitySignals) (integrations.EligibilityAssessment, error)
}

type ActivityCountSource interface {
	PostsAndLivesLastYear(ctx context.Context, accountId uuid.UUID) (posts *int, lives *int)
}

type PendingWithdrawalChecker interface {
	HasPendingWithdrawals(ctx context.Context, accountId uuid.UUID) (bool, error)
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
