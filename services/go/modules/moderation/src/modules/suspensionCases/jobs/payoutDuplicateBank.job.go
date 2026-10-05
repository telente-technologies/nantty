package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"zudomart/modules/moderation/src/container"
	ingestsuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/commands/ingestSuspensionCase"
	platformevents "zudomart/platform/events"
)

const DuplicateBankAccountEventType = "payoutAccount.duplicateBankAccount"

type duplicateBankAccountData struct {
	UserId       string   `json:"userId"`
	LinkedUserId string   `json:"linkedUserId"`
	SuggestionId string   `json:"suggestionId"`
	Signals      []string `json:"signals"`
	RiskScore    int      `json:"riskScore"`
	AdvisoryOnly bool     `json:"advisoryOnly"`
}

func DuplicateBankAccountEnvelopeHandler(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil || envelope.Type != DuplicateBankAccountEventType {
			return nil
		}
		var data duplicateBankAccountData
		if err := json.Unmarshal(envelope.Data, &data); err != nil {
			return fmt.Errorf("%w: %s data is malformed", platformevents.ErrPoisonMessage, envelope.Type)
		}
		if !data.AdvisoryOnly || data.UserId == "" || data.SuggestionId == "" || len(data.Signals) == 0 {
			return nil
		}
		signals := make([]json.RawMessage, 0, len(data.Signals))
		for _, code := range data.Signals {
			entry, _ := json.Marshal(map[string]any{"label": code, "weight": 1, "detail": "Payout bank account already linked to account " + data.LinkedUserId})
			signals = append(signals, entry)
		}
		_, err := ingestsuspensioncase.Handler{Container: application}.Execute(ctx, ingestsuspensioncase.Command{
			AccountId: data.UserId, Source: "python_suggestion", RiskScore: min(100, max(0, data.RiskScore)), TopSignals: data.Signals, Signals: signals,
			ModelVersion: "payout_onboarding", ExternalReference: data.SuggestionId,
		})
		return err
	}
}
