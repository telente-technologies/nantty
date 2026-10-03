package interfaces

import (
	"context"

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

type ProductPinPolicy interface {
	CanPinProducts(ctx context.Context, hostId uuid.UUID, roles []string, productIds []uuid.UUID) error
}
