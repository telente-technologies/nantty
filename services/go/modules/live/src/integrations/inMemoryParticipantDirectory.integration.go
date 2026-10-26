package integrations

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
)

type InMemoryParticipantDirectory struct {
	mutex        sync.Mutex
	Participants map[uuid.UUID]interfaces.Participant
}

func NewInMemoryParticipantDirectory() *InMemoryParticipantDirectory {
	return &InMemoryParticipantDirectory{Participants: map[uuid.UUID]interfaces.Participant{}}
}

func (directory *InMemoryParticipantDirectory) Register(participant interfaces.Participant) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	directory.Participants[participant.Id] = participant
}

func (directory *InMemoryParticipantDirectory) LookupParticipants(_ context.Context, identifiers []uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	found := map[uuid.UUID]interfaces.Participant{}
	for _, identifier := range identifiers {
		if participant, known := directory.Participants[identifier]; known {
			found[identifier] = participant
		}
	}
	return found, nil
}
