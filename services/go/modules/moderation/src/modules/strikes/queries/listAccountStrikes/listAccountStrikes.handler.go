package listaccountstrikes

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/strike"
	"nantty/modules/moderation/src/modules/strikes/services"
	"nantty/platform/httpserver"
)

type Result struct {
	Strikes                  []services.StrikeView `json:"strikes"`
	StrikeCount              int                   `json:"strikeCount"`
	WarningCount             int                   `json:"warningCount"`
	IsRepeatInfringer        bool                  `json:"isRepeatInfringer"`
	RepeatInfringerThreshold int                   `json:"repeatInfringerThreshold"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string, includeInactive bool) (Result, error) {
	account, err := uuid.Parse(accountId)
	if err != nil {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountId", Message: "must be an account id"}})
	}
	now := handler.Container.Now()
	rows, err := handler.Container.Client.Strike.Query().Where(strike.AccountID(account)).Order(ent.Desc(strike.FieldCreatedAt)).Limit(200).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Strikes: []services.StrikeView{}, RepeatInfringerThreshold: services.RepeatInfringerThreshold}
	for _, row := range rows {
		view := services.BuildStrikeView(row, now)
		if view.Status == "active" {
			if row.Kind == strike.KindWarning {
				result.WarningCount++
			} else {
				result.StrikeCount++
			}
		}
		if view.Status == "active" || includeInactive {
			result.Strikes = append(result.Strikes, view)
		}
	}
	result.IsRepeatInfringer = services.IsRepeatInfringer(result.StrikeCount)
	return result, nil
}
