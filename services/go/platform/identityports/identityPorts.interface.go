package identityports

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwk"
)

var (
	ErrUsernameAlreadyTaken = errors.New("username already taken")
	ErrPortNotRegistered    = errors.New("identity port not registered")
	ErrSettingNotFound      = errors.New("platform setting not found")
	ErrEmailAlreadyTaken    = errors.New("email already taken")
)

type AccountSummary struct {
	ID            uuid.UUID
	Username      string
	Name          string
	Email         *string
	Birthday      *time.Time
	Roles         []string
	EmailVerified bool
	PhoneVerified bool
	Active        bool
	Status        string
	CreatedAt     time.Time
}

type AccountDirectory interface {
	FindAccountSummary(ctx context.Context, accountId uuid.UUID) (AccountSummary, bool, error)
	FindAccountSummaryByUsername(ctx context.Context, username string) (AccountSummary, bool, error)
	IsUsernameTaken(ctx context.Context, username string, excludingAccountId uuid.UUID) (bool, error)
	RenameAccountUsername(ctx context.Context, accountId uuid.UUID, username string) error
	DeactivateAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID) error
}

type UsernameBlock struct {
	Blocked bool
	Reason  string
}

type UsernameGuard interface {
	DescribeUsernameBlock(ctx context.Context, username string, requester uuid.UUID) (UsernameBlock, error)
	FindBlockedUsernames(ctx context.Context, candidates []string) ([]string, error)
}

type StaffTokenClaims struct {
	StaffId   string
	SessionId string
	Roles     []string
	StepUp    bool
}

type StaffTokenService interface {
	SignStaffAccessToken(claims StaffTokenClaims) (string, int, error)
	SignStaffStepUpToken(claims StaffTokenClaims, timeToLive time.Duration) (string, error)
	PublishedKeySet(ctx context.Context) (jwk.Set, error)
	StaffTokenIssuer() string
}

type AuditEvent struct {
	ActorId          string
	ActorName        string
	ActorRole        string
	ActorDepartments []string
	SubjectLabel     string
	StepUpVerified   bool
	Action           string
	SubjectType      string
	SubjectId        string
	Before           json.RawMessage
	After            json.RawMessage
	Reason           string
	IpAddress        string
	UserAgent        string
	RequestId        string
}

type AuditRecorder interface {
	RecordAuditEvent(ctx context.Context, event AuditEvent) error
}

type AccountCountryLookup interface {
	FindAccountCountryCode(ctx context.Context, accountId uuid.UUID) (string, error)
}

type PlatformSettings interface {
	ReadSettingValue(ctx context.Context, key string) (json.RawMessage, int, error)
}

type AccountSession struct {
	ID         uuid.UUID
	IpAddress  string
	UserAgent  string
	StartedAt  time.Time
	LastSeenAt time.Time
}

type BanDetails struct {
	Reason            string
	BlockedBy         string
	BlockFutureSignup bool
}

type AccountEnforcement interface {
	SuspendAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID) error
	ReinstateAccount(ctx context.Context, accountId uuid.UUID) error
	BanAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID, details BanDetails) error
	LiftBan(ctx context.Context, accountId uuid.UUID) error
	RevokeAccountSessions(ctx context.Context, accountId uuid.UUID, onlySessionId *uuid.UUID) error
	ListActiveAccountSessions(ctx context.Context, accountId uuid.UUID) ([]AccountSession, error)
	MarkAccountDeleted(ctx context.Context, accountId uuid.UUID, anonymizedUsername string) error
	ChangeAccountPassword(ctx context.Context, accountId uuid.UUID, newPassword string, mustChange bool) error
	CreateAccountOnBehalf(ctx context.Context, request CreateAccountRequest) (uuid.UUID, error)
	SetAccountRole(ctx context.Context, accountId uuid.UUID, role string, granted bool) error
}

type CreateAccountRequest struct {
	Username string
	Name     string
	Email    string
	Password string
}

type CurrencyResolver interface {
	CurrencyForCountry(countryCode string) (string, bool)
}

type StaffSessionChecker interface {
	IsStaffSessionActive(ctx context.Context, staffId, sessionId string) (bool, error)
}

type AuditHistoryReader interface {
	ListAuditHistoryForSubject(ctx context.Context, subjectType, subjectId string, limit int) ([]json.RawMessage, error)
}

type DeletionGraceCanceller interface {
	CancelPendingDeletionOnLogin(ctx context.Context, accountId uuid.UUID) (bool, error)
	AccountDeletionExecuted(ctx context.Context, accountId uuid.UUID) (bool, error)
}
