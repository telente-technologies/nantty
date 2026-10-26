package ingestlivesafetyscore

import (
	"encoding/json"

	"nantty/modules/moderation/src/modules/liveSafety/services"
)

type Label struct {
	Name       string  `json:"name"`
	ParentName string  `json:"parentName"`
	Confidence float64 `json:"confidence"`
}

type Command struct {
	ScoreId            string                        `json:"scoreId"`
	LiveId             string                        `json:"liveId"`
	HostId             string                        `json:"hostId"`
	Kind               string                        `json:"kind"`
	FrameRef           string                        `json:"frameRef"`
	CapturedAt         string                        `json:"capturedAt"`
	Labels             []Label                       `json:"labels"`
	Categories         []services.CategoryConfidence `json:"categories"`
	Confidence         float64                       `json:"confidence"`
	SuggestedAction    string                        `json:"suggestedAction"`
	ModelVersion       string                        `json:"modelVersion"`
	TranscriptSnippet  string                        `json:"transcriptSnippet"`
	HashMatch          bool                          `json:"hashMatch"`
	HashMatchProvider  string                        `json:"hashMatchProvider"`
	HashMatchReference string                        `json:"hashMatchReference"`
	AdvisoryOnly       bool                          `json:"advisoryOnly"`
	GeneratedAt        string                        `json:"generatedAt"`
}

type Result struct {
	Action     string `json:"action"`
	IncidentId string `json:"incidentId"`
	Duplicate  bool   `json:"duplicate"`
}

func (command Command) labelsJson() json.RawMessage {
	if command.HashMatch {
		return nil
	}
	encoded, _ := json.Marshal(command.Labels)
	return encoded
}

func (command Command) categoriesJson() json.RawMessage {
	encoded, _ := json.Marshal(command.Categories)
	return encoded
}
