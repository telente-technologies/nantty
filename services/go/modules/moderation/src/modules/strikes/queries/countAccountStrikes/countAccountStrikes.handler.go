package countaccountstrikes

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
)

const maximumAccountsPerRequest = 500

type Entry struct {
	StrikeCount  int `json:"strikeCount"`
	WarningCount int `json:"warningCount"`
}

type Result struct {
	Data map[string]Entry `json:"data"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountIds []string) (Result, error) {
	if len(accountIds) == 0 || len(accountIds) > maximumAccountsPerRequest {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountIds", Message: "must list 1 to 500 account ids"}})
	}
	parsed := make([]uuid.UUID, 0, len(accountIds))
	for _, raw := range accountIds {
		identifier, err := uuid.Parse(raw)
		if err != nil {
			return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountIds", Message: "must be account ids"}})
		}
		parsed = append(parsed, identifier)
	}
	counts, err := services.ActiveCounts(ctx, handler.Container.Client, handler.Container.Now(), parsed)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: make(map[string]Entry, len(parsed))}
	for _, identifier := range parsed {
		result.Data[identifier.String()] = Entry{StrikeCount: counts[identifier].ActiveStrikes, WarningCount: counts[identifier].ActiveWarnings}
	}
	return result, nil
}
