package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"zudomart/modules/moderation/src/container"
	ingestsuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/commands/ingestSuspensionCase"
	platformevents "zudomart/platform/events"
)

const VerificationFraudSignalEventType = "verification.fraudSignalDetected"

type verificationFraudData struct {
	SuggestionId string   `json:"suggestionId"`
	AccountId    string   `json:"accountId"`
	CaseId       string   `json:"caseId"`
	Signals      []string `json:"signals"`
	RiskScore    int      `json:"riskScore"`
	AdvisoryOnly bool     `json:"advisoryOnly"`
}

func VerificationFraudEnvelopeHandler(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil || envelope.Type != VerificationFraudSignalEventType {
			return nil
		}
		var data verificationFraudData
		if err := json.Unmarshal(envelope.Data, &data); err != nil {
			return fmt.Errorf("%w: %s data is malformed", platformevents.ErrPoisonMessage, envelope.Type)
		}
		if !data.AdvisoryOnly || data.AccountId == "" || len(data.Signals) == 0 {
			return nil
		}
		signals := make([]json.RawMessage, 0, len(data.Signals))
		for _, code := range data.Signals {
			entry, _ := json.Marshal(map[string]any{"label": code, "weight": 1, "detail": "Raised by checkmark identity verification (case " + data.CaseId + ")"})
			signals = append(signals, entry)
		}
		_, err := ingestsuspensioncase.Handler{Container: application}.Execute(ctx, ingestsuspensioncase.Command{
			AccountId: data.AccountId, Source: "python_suggestion", RiskScore: min(100, max(0, data.RiskScore)), TopSignals: data.Signals, Signals: signals,
			ModelVersion: "smile_id_verification", ExternalReference: data.SuggestionId,
		})
		return err
	}
}
