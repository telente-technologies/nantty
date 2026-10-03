package ingestcontentscore

import "encoding/json"

type Category struct {
	Category string  `json:"category"`
	Score    float64 `json:"score"`
}

type Command struct {
	ScoreId         string     `json:"scoreId"`
	TargetType      string     `json:"targetType"`
	TargetId        string     `json:"targetId"`
	OwnerId         string     `json:"ownerId"`
	Score           float64    `json:"score"`
	SuggestedAction string     `json:"suggestedAction"`
	Categories      []Category `json:"categories"`
	ModelVersion    string     `json:"modelVersion"`
	AdvisoryOnly    bool       `json:"advisoryOnly"`
	GeneratedAt     string     `json:"generatedAt"`
}

type Result struct {
	Action   string
	ReportId string
}

func (command Command) scoresJson() json.RawMessage {
	items := make([]map[string]any, 0, len(command.Categories))
	for _, category := range command.Categories {
		items = append(items, map[string]any{"label": category.Category, "score": category.Score})
	}
	encoded, _ := json.Marshal(items)
	return encoded
}
