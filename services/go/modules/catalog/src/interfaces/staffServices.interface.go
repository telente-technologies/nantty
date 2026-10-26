package interfaces

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/platform/staffaudit"
)

type AuditTrail interface {
	Record(ctx context.Context, record staffaudit.Record) error
	History(ctx context.Context, subjectType, subjectId string) ([]json.RawMessage, error)
}

type IdentityDirectory interface {
	UserSummaries(ctx context.Context, accountIds []uuid.UUID) (map[uuid.UUID]map[string]any, error)
}

type PrivateMediaSigner interface {
	SignedUrl(ctx context.Context, mediaId, actorId, reason string) (string, time.Time, error)
}

type StoreFollowStats interface {
	StoreFollowStats(ctx context.Context, storeId uuid.UUID, viewer *uuid.UUID) (followers int, isFollowing bool)
}
