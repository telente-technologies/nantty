package liststrikeappeals

import (
	"context"
	"time"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/strike"
)

type AppealView struct {
	StrikeId   string  `json:"strikeId"`
	AccountId  string  `json:"accountId"`
	Kind       string  `json:"kind"`
	Policy     string  `json:"policy"`
	Reason     string  `json:"reason"`
	Source     string  `json:"source"`
	Message    string  `json:"message"`
	AppealedAt *string `json:"appealedAt"`
	IssuedAt   string  `json:"issuedAt"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (map[string][]AppealView, error) {
	rows, err := handler.Container.Client.Strike.Query().Where(strike.AppealStatusEQ(strike.AppealStatusPending)).Order(ent.Asc(strike.FieldAppealedAt)).Limit(100).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]AppealView, 0, len(rows))
	for _, row := range rows {
		view := AppealView{StrikeId: row.ID.String(), AccountId: row.AccountID.String(), Kind: string(row.Kind), Policy: row.Policy, Reason: row.Reason, Source: string(row.Source), Message: row.AppealMessage, IssuedAt: row.CreatedAt.UTC().Format(time.RFC3339)}
		if row.AppealedAt != nil {
			formatted := row.AppealedAt.UTC().Format(time.RFC3339)
			view.AppealedAt = &formatted
		}
		views = append(views, view)
	}
	return map[string][]AppealView{"data": views}, nil
}
