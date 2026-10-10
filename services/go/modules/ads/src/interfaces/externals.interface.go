package interfaces

import (
	"context"
	"encoding/json"
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
	ChargeEarningsForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error
	RefundBoostCharge(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey, debitIdempotencyKey string) error
}

type VerificationStatus struct {
	Level    int
	NextStep string
}

type VerificationReader interface {
	ReadVerificationLevel(ctx context.Context, userId string) (VerificationStatus, error)
}

type EntitlementReader interface {
	IsPremium(ctx context.Context, userId string) (bool, error)
}

type EarningsFundingResult struct {
	FundingId   string
	AmountMinor int64
	Currency    string
}

type EarningsFunding interface {
	FundAdAccountFromEarnings(ctx context.Context, userId, adAccountId, currency string, amountMinor int64, idempotencyKey string) (EarningsFundingResult, error)
}

type UserSummary struct {
	Id       string
	Username string
	Name     string
}

type UserDirectory interface {
	LookupUsers(ctx context.Context, ids []string) (map[string]UserSummary, error)
	FindUserByUsername(ctx context.Context, username string) (UserSummary, bool, error)
	FindUserByEmail(ctx context.Context, email string) (UserSummary, bool, error)
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

type AudienceMemberSource interface {
	StoreCustomers(ctx context.Context, storeId string, retentionDays, minimumOrders int) ([]string, error)
	Engagers(ctx context.Context, ownerUserId, engagementSource string, retentionDays int) ([]string, error)
	Followers(ctx context.Context, ownerUserId string) ([]string, error)
}

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

type ContentSourceDirectory interface {
	ListContentSources(ctx context.Context, query ContentSourceQuery) (items []map[string]any, nextCursor string, err error)
}

type ObjectUploadTicket struct {
	Url     string
	Headers map[string]string
}

type ObjectStorage interface {
	PresignUpload(ctx context.Context, key, contentType string, sizeBytes int64, timeToLive time.Duration) (ObjectUploadTicket, error)
	PresignDownload(ctx context.Context, key string, timeToLive time.Duration) (string, error)
	PutObject(ctx context.Context, key, contentType string, body []byte) error
	Exists(ctx context.Context, key string) (bool, int64, error)
	ReadPrefix(ctx context.Context, key string, maximumBytes int64) ([]byte, error)
}

type OwnershipQuery struct {
	Kind        string
	TargetId    string
	OwnerUserId string
	StoreId     string
}

type DestinationOwnership interface {
	Owns(ctx context.Context, query OwnershipQuery) (bool, error)
}

type TopUpStartRequest struct {
	UserId         string
	IdempotencyKey string
	AdAccountId    string
	AmountMinor    int64
	Currency       string
	ReturnTo       string
}

type StartedTopUp struct {
	TopUpId     string
	Reference   string
	CheckoutUrl string
}

type TopUpStatus struct {
	TopUpId     string
	Status      string
	AmountMinor int64
	Currency    string
	CompletedAt *time.Time
}

type TopUpGateway interface {
	StartTopUp(ctx context.Context, request TopUpStartRequest) (StartedTopUp, error)
	ReadTopUp(ctx context.Context, adAccountId, reference string) (TopUpStatus, error)
}

type AuditHistoryReader interface {
	ListHistory(ctx context.Context, subjectType, subjectId string) ([]json.RawMessage, error)
}

type PlatformUserSummaries interface {
	LookupSummaries(ctx context.Context, ids []string) (map[string]json.RawMessage, error)
}
