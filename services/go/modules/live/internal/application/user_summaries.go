package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ports"
)

func (application *LiveApplication) lookupParticipants(ctx context.Context, identifiers ...uuid.UUID) (map[uuid.UUID]ports.Participant, error) {
	unique := make([]uuid.UUID, 0, len(identifiers))
	seen := map[uuid.UUID]bool{}
	for _, identifier := range identifiers {
		if !seen[identifier] {
			seen[identifier] = true
			unique = append(unique, identifier)
		}
	}
	found, err := application.Directory.LookupParticipants(ctx, unique)
	if err != nil {
		return nil, err
	}
	for _, identifier := range unique {
		if _, known := found[identifier]; !known {
			found[identifier] = ports.Participant{Id: identifier, Name: "Zudomart user", Username: identifier.String()[:8]}
		}
	}
	return found, nil
}

func summarise(participant ports.Participant) UserSummary {
	return UserSummary{
		Id: participant.Id.String(), Name: participant.Name, Username: participant.Username, AvatarUrl: participant.AvatarUrl,
		Verified: participant.Verified, IsCreator: participant.IsCreatorProgramMember,
	}
}

func summariesById(participants map[uuid.UUID]ports.Participant) map[uuid.UUID]UserSummary {
	summaries := make(map[uuid.UUID]UserSummary, len(participants))
	for identifier, participant := range participants {
		summaries[identifier] = summarise(participant)
	}
	return summaries
}
