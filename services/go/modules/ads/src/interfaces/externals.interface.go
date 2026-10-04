package interfaces

import (
	"context"
	"time"

	"zudomart/modules/ads/src/types"
)

type ConsentReader interface {
	PersonalizedAdsEnabled(ctx context.Context, userId string) (bool, error)
}

type ContentSignalReader interface {
	FindContentSignal(ctx context.Context, contentId string) (types.ContentSignal, bool, error)
}

type PctrScorer interface {
	ScorePredictedClickRatesInPpm(ctx context.Context, request types.PctrRequest) (map[string]int64, error)
}

type FraudModelScorer interface {
	ScoreAdEvent(ctx context.Context, impressionId, userId, eventKind string, signals types.AdClickSignals) (*float64, error)
}

type FundingGateway interface {
	ChargeUserWalletForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error
	RefundBoostCharge(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey, debitIdempotencyKey string) error
}

type UserSummary struct {
	Id       string
	Username string
	Name     string
}

type UserDirectory interface {
	LookupUsers(ctx context.Context, ids []string) (map[string]UserSummary, error)
	FindUserByUsername(ctx context.Context, username string) (UserSummary, bool, error)
}

type ManagedStore struct {
	StoreId      string
	Name         string
	Handle       string
	LogoUrl      *string
	CountryCode  string
	GoldVerified bool
}

type StoreDirectory interface {
	ListStoresManagedBy(ctx context.Context, userId string) ([]ManagedStore, error)
}

// AudienceMemberSource resolves the user ids behind engagement-based audiences from the services that own that data.
type AudienceMemberSource interface {
	StoreCustomers(ctx context.Context, storeId string, retentionDays, minimumOrders int) ([]string, error)
	Engagers(ctx context.Context, ownerUserId, engagementSource string, retentionDays int) ([]string, error)
	Followers(ctx context.Context, ownerUserId string) ([]string, error)
}

// IdentityMatcher matches SHA-256 hashes of normalized identifiers to user ids; unmatched hashes are discarded by the caller.
type IdentityMatcher interface {
	MatchEmailHashes(ctx context.Context, hashes []string) ([]string, error)
	MatchPhoneHashes(ctx context.Context, hashes []string) ([]string, error)
}

type ContentSourceQuery struct {
	OwnerUserId string
	StoreId     string
	Type        string
	Search      string
	Cursor      string
	Limit       int
}

// ContentSourceDirectory lists boostable social posts, clips, products, live sessions and stores of an advertiser.
type ContentSourceDirectory interface {
	ListContentSources(ctx context.Context, query ContentSourceQuery) (items []map[string]any, nextCursor string, err error)
}

type ObjectUploadTicket struct {
	Url     string
	Headers map[string]string
}

// ObjectStorage issues presigned S3 URLs; objects are never proxied through the ads service.
type ObjectStorage interface {
	PresignUpload(ctx context.Context, key, contentType string, sizeBytes int64, timeToLive time.Duration) (ObjectUploadTicket, error)
	PresignDownload(ctx context.Context, key string, timeToLive time.Duration) (string, error)
	PutObject(ctx context.Context, key, contentType string, body []byte) error
	Exists(ctx context.Context, key string) (bool, int64, error)
}

type OwnershipQuery struct {
	Kind        string
	TargetId    string
	OwnerUserId string
	StoreId     string
}

// DestinationOwnership asks the owning service (social for posts and clips, commerce for products and stores, identity for profiles)
// whether the advertiser owns the target or is on the team that manages it.
type DestinationOwnership interface {
	Owns(ctx context.Context, query OwnershipQuery) (bool, error)
}
