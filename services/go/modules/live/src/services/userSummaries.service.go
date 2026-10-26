package services

import (
	"context"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

func (service *LiveService) lookupParticipants(ctx context.Context, identifiers ...uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	unique := make([]uuid.UUID, 0, len(identifiers))
	seen := map[uuid.UUID]bool{}
	for _, identifier := range identifiers {
		if !seen[identifier] {
			seen[identifier] = true
			unique = append(unique, identifier)
		}
	}
	found, err := service.Directory.LookupParticipants(ctx, unique)
	if err != nil {
		return nil, err
	}
	for _, identifier := range unique {
		if _, known := found[identifier]; !known {
			found[identifier] = interfaces.Participant{Id: identifier, Name: "Zudomart user", Username: identifier.String()[:8]}
		}
	}
	return found, nil
}

func summarise(participant interfaces.Participant) types.UserSummary {
	return types.UserSummary{
		Id: participant.Id.String(), Name: participant.Name, Username: participant.Username, AvatarUrl: participant.AvatarUrl,
		Verified: participant.Verified, IsCreator: participant.IsCreatorProgramMember,
	}
}

func summariesById(participants map[uuid.UUID]interfaces.Participant) map[uuid.UUID]types.UserSummary {
	summaries := make(map[uuid.UUID]types.UserSummary, len(participants))
	for identifier, participant := range participants {
		summaries[identifier] = summarise(participant)
	}
	return summaries
}
