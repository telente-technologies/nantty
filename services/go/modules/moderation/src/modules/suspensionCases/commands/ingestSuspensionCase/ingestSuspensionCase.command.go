package ingestsuspensioncase

import "encoding/json"

type Command struct {
	AccountId         string            `json:"accountId"`
	Source            string            `json:"source"`
	RiskScore         int               `json:"riskScore"`
	TopSignals        []string          `json:"topSignals"`
	ReportCount       int               `json:"reportCount"`
	Signals           []json.RawMessage `json:"signals"`
	Evidence          []json.RawMessage `json:"evidence"`
	Reports           []json.RawMessage `json:"reports"`
	ModelVersion      string            `json:"modelVersion"`
	ExternalReference string            `json:"externalReference"`
}
