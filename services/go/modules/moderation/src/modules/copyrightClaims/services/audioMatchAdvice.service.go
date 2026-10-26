package services

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/integrations"
	recordaudiomatches "nantty/modules/moderation/src/modules/copyrightClaims/commands/recordAudioMatches"
	"nantty/platform/httpserver"
)

const AudioMatchAdviceSource = "Chromaprint fingerprint (advice only)"

var (
	ErrAudioMatchNotPossible = httpserver.NewApiError(http.StatusConflict, "AUDIO_MATCH_NOT_POSSIBLE", "An audio match needs the original work uploaded with the claim and video or audio on the claimed content.")
	ErrAudioMatchUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "AUDIO_MATCH_UNAVAILABLE", "Audio fingerprinting is not available right now. Decide on the proof provided.")
)

func TargetMediaIdsOf(claim *ent.CopyrightClaim) []string {
	var preview integrations.TargetPreview
	if claim.TargetPreview == nil || json.Unmarshal(claim.TargetPreview, &preview) != nil {
		return nil
	}
	return preview.MediaIds
}

func AdviceToMatches(claim *ent.CopyrightClaim, result integrations.AudioMatchAdviceResult) []recordaudiomatches.Match {
	matches := make([]recordaudiomatches.Match, 0, len(result.Matches))
	for _, advice := range result.Matches {
		segment, _ := json.Marshal(map[string]float64{"targetStartSeconds": advice.TargetStartSeconds, "targetEndSeconds": advice.TargetEndSeconds, "referenceStartSeconds": advice.ReferenceStartSeconds})
		matches = append(matches, recordaudiomatches.Match{
			MatchedTrack: claim.WorkTitle, Artist: claimantLabel(claim), ConfidencePercent: max(0, min(100, advice.ConfidencePercent)), Source: AudioMatchAdviceSource, Segments: []json.RawMessage{segment},
		})
	}
	return matches
}

func claimantLabel(claim *ent.CopyrightClaim) string {
	if claim.ClaimantOrganization != "" {
		return claim.ClaimantOrganization
	}
	return claim.ClaimantName
}

func RunAudioMatchAdvice(ctx context.Context, c *container.Container, claim *ent.CopyrightClaim) error {
	targetMediaIds := TargetMediaIdsOf(claim)
	if claim.OriginalWorkMediaID == "" || len(targetMediaIds) == 0 {
		return ErrAudioMatchNotPossible
	}
	if len(targetMediaIds) > 10 {
		targetMediaIds = targetMediaIds[:10]
	}
	result, err := c.AudioMatches.MatchCopyrightAudio(ctx, claim.ID.String(), claim.OriginalWorkMediaID, targetMediaIds)
	if errors.Is(err, integrations.ErrAudioMatchUnavailable) || (err == nil && !result.Available) {
		return ErrAudioMatchUnavailable
	}
	if err != nil {
		return err
	}
	return recordaudiomatches.Handler{Container: c}.Execute(ctx, claim.ID.String(), AdviceToMatches(claim, result))
}
