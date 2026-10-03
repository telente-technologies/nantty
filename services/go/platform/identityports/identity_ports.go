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
)

type AccountSummary struct {
	ID            uuid.UUID
	Username      string
	Name          string
	Email         *string
	Birthday      *time.Time
	Roles         []string
	EmailVerified bool
	Active        bool
	CreatedAt     time.Time
}

type AccountDirectory interface {
	FindAccountSummary(ctx context.Context, accountId uuid.UUID) (AccountSummary, bool, error)
	RenameAccountUsername(ctx context.Context, accountId uuid.UUID, username string) error
	DeactivateAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID) error
}

type UsernameBlock struct {
	Blocked bool
	Reason  string
}

type UsernameGuard interface {
	DescribeUsernameBlock(ctx context.Context, username string, requester uuid.UUID) (UsernameBlock, error)
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
	ActorId     string
	ActorRole   string
	Action      string
	SubjectType string
	SubjectId   string
	Before      json.RawMessage
	After       json.RawMessage
	Reason      string
	IpAddress   string
	UserAgent   string
	RequestId   string
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
