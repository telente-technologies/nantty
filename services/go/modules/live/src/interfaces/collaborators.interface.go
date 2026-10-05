package interfaces

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Participant struct {
	Id                     uuid.UUID
	Name                   string
	Username               string
	AvatarUrl              *string
	Verified               bool
	IsCreatorProgramMember bool
}

type ParticipantDirectory interface {
	LookupParticipants(ctx context.Context, identifiers []uuid.UUID) (map[uuid.UUID]Participant, error)
}

type MediaRoomController interface {
	RemoveParticipant(ctx context.Context, room, identity string) error
	SetParticipantTracksMuted(ctx context.Context, room, identity string, audio, video *bool) error
}

type StoreProduct struct {
	Id         uuid.UUID
	Title      string
	PriceMinor int64
	Currency   string
	ImageUrl   *string
	Status     string
}

type StoreCatalog interface {
	IsStoreMember(ctx context.Context, storeId, userId uuid.UUID) (bool, error)
	OwnedProducts(ctx context.Context, storeId uuid.UUID, productIds []uuid.UUID) (map[uuid.UUID]StoreProduct, error)
}

type IngressProtocol string

const (
	IngressRtmp IngressProtocol = "rtmp"
	IngressWhip IngressProtocol = "whip"
)

type IngressRequest struct {
	Room            string
	ParticipantId   string
	ParticipantName string
	Protocol        IngressProtocol
}

type IngressCredentials struct {
	IngressId string
	Url       string
	StreamKey string
}

type IngressController interface {
	CreateIngress(ctx context.Context, request IngressRequest) (IngressCredentials, error)
	GetIngress(ctx context.Context, ingressId string) (IngressCredentials, error)
	DeleteIngress(ctx context.Context, ingressId string) error
}

type RecordingController interface {
	StartRoomRecording(ctx context.Context, room, objectKey string) (egressId string, err error)
	StopRecording(ctx context.Context, egressId string) error
}

type RecordingStorage interface {
	PresignDownload(ctx context.Context, objectKey string, timeToLive time.Duration) (string, error)
}

type MentionPrivacy string

const (
	MentionEveryone  MentionPrivacy = "everyone"
	MentionFollowing MentionPrivacy = "following"
	MentionNobody    MentionPrivacy = "no_one"
)

type SocialRelations interface {
	BlockedEitherWay(ctx context.Context, userId uuid.UUID, others []uuid.UUID) (map[uuid.UUID]bool, error)
	IsFollowing(ctx context.Context, followerId, followeeId uuid.UUID) (bool, error)
	FollowCounts(ctx context.Context, userId uuid.UUID) (followers, following int, err error)
	IsActiveSubscriber(ctx context.Context, subscriberId, creatorId uuid.UUID) (bool, error)
	MentionPrivacyOf(ctx context.Context, userIds []uuid.UUID) (map[uuid.UUID]MentionPrivacy, error)
	ListLiveAlertRecipients(ctx context.Context, hostId uuid.UUID, limit int) (recipients []uuid.UUID, truncated bool, err error)
}

type SubscriberDirectory interface {
	IsActiveSubscriber(ctx context.Context, subscriberId, creatorId uuid.UUID) (bool, error)
	CountNewSubscribers(ctx context.Context, creatorId uuid.UUID, from, to time.Time) (int, error)
}
