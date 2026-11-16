package live_test

import (
	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
)

func integrationsParticipant(identifier uuid.UUID, name string, creator bool) interfaces.Participant {
	return interfaces.Participant{Id: identifier, Name: name, Username: name, IsCreatorProgramMember: creator}
}
