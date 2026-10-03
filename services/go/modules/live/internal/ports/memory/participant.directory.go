package memory

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ports"
)

type ParticipantDirectory struct {
	mutex        sync.Mutex
	Participants map[uuid.UUID]ports.Participant
}

func NewParticipantDirectory() *ParticipantDirectory {
	return &ParticipantDirectory{Participants: map[uuid.UUID]ports.Participant{}}
}

func (directory *ParticipantDirectory) Register(participant ports.Participant) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	directory.Participants[participant.Id] = participant
}

func (directory *ParticipantDirectory) LookupParticipants(_ context.Context, identifiers []uuid.UUID) (map[uuid.UUID]ports.Participant, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	found := map[uuid.UUID]ports.Participant{}
	for _, identifier := range identifiers {
		if participant, known := directory.Participants[identifier]; known {
			found[identifier] = participant
		}
	}
	return found, nil
}
