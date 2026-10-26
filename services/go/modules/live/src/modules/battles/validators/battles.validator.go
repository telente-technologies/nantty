package validators

import (
	"github.com/google/uuid"

	"nantty/modules/live/src/modules/battles/dtos"
	"nantty/modules/live/src/utils"
)

func ValidateCreateBattleRequest(body dtos.CreateBattleRequest) error {
	var collected utils.Issues
	parsed := utils.ParseIdentifiers("participantUserIds", body.ParticipantUserIds, &collected)
	unique := map[uuid.UUID]bool{}
	for _, identifier := range parsed {
		unique[identifier] = true
	}
	if len(unique) != len(parsed) || len(parsed) < 2 || len(parsed) > 10 {
		collected.Add("participantUserIds", "needs 2 to 10 different streamers")
	}
	if body.DurationSeconds < 60 || body.DurationSeconds > 600 {
		collected.Add("durationSeconds", "must be between 60 and 600")
	}
	return collected.AsError()
}
