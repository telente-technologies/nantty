package recordaudiomatches

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/platform/httpserver"
)

type Match struct {
	MatchedTrack      string            `json:"matchedTrack"`
	Artist            string            `json:"artist"`
	ConfidencePercent int               `json:"confidencePercent"`
	Source            string            `json:"source"`
	Segments          []json.RawMessage `json:"segments"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, claimId string, matches []Match) error {
	identifier, err := uuid.Parse(claimId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	if len(matches) > 20 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "matches", Message: "at most 20 matches"}})
	}
	top := 0
	for index := range matches {
		if matches[index].ConfidencePercent < 0 || matches[index].ConfidencePercent > 100 {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "matches", Message: "confidencePercent must be 0 to 100"}})
		}
		if matches[index].Segments == nil {
			matches[index].Segments = []json.RawMessage{}
		}
		top = max(top, matches[index].ConfidencePercent)
	}
	encoded, _ := json.Marshal(matches)
	update := handler.Container.Client.CopyrightClaim.UpdateOneID(identifier).SetAudioMatches(encoded)
	if len(matches) > 0 {
		update.SetTopAudioMatchPercent(top)
	}
	if err := update.Exec(ctx); ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	} else {
		return err
	}
}
