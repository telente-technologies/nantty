package ingestsuspensioncase

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/suspensioncase"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (string, error) {
	account, err := uuid.Parse(command.AccountId)
	invalid := func(path, message string) error {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
	}
	if err != nil {
		return "", invalid("accountId", "must be an account id")
	}
	if command.Source != "python_suggestion" && command.Source != "user_reports" && command.Source != "copyright_strikes" {
		return "", invalid("source", "must be python_suggestion, user_reports or copyright_strikes")
	}
	if command.RiskScore < 0 || command.RiskScore > 100 || len(command.TopSignals) > 10 || len(command.ExternalReference) > 128 {
		return "", invalid("riskScore", "must be 0 to 100 with at most 10 top signals")
	}
	if command.ExternalReference != "" {
		if existing, err := handler.Container.Client.SuspensionCase.Query().Where(suspensioncase.ExternalReference(command.ExternalReference)).Only(ctx); err == nil {
			return existing.ID.String(), nil
		} else if !ent.IsNotFound(err) {
			return "", err
		}
	}
	var created *ent.SuspensionCase
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		builder := tx.SuspensionCase.Create().SetAccountID(account).SetSource(suspensioncase.Source(command.Source)).SetRiskScore(command.RiskScore).SetTopSignals(command.TopSignals).SetReportCount(command.ReportCount).
			SetSignals(encode(command.Signals)).SetEvidence(encode(command.Evidence)).SetReports(encode(command.Reports)).SetModelVersion(command.ModelVersion)
		if command.ExternalReference != "" {
			builder.SetExternalReference(command.ExternalReference)
		}
		var err error
		if created, err = builder.Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "suspensionCase.opened", created.ID.String(), handler.Container.Now(), map[string]any{"caseId": created.ID.String(), "accountId": account.String(), "source": command.Source, "riskScore": command.RiskScore})
	})
	if ent.IsConstraintError(err) && command.ExternalReference != "" {
		existing, lookupErr := handler.Container.Client.SuspensionCase.Query().Where(suspensioncase.ExternalReference(command.ExternalReference)).Only(ctx)
		if lookupErr == nil {
			return existing.ID.String(), nil
		}
	}
	if err != nil {
		return "", err
	}
	return created.ID.String(), nil
}

func encode(items []json.RawMessage) []byte {
	if items == nil {
		items = []json.RawMessage{}
	}
	encoded, _ := json.Marshal(items)
	return encoded
}
