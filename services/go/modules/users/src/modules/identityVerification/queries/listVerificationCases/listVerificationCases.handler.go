package listverificationcases

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/verificationcase"
	"nantty/modules/users/src/modules/identityVerification/services"
)

type Query struct {
	Status string
	Limit  int
}

type Item struct {
	services.CaseView
	ProfileHandle string `json:"profileHandle"`
	ProfileName   string `json:"profileName"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]Item, error) {
	status := verificationcase.Status(query.Status)
	if query.Status == "" {
		status = verificationcase.StatusUnderReview
	}
	if err := verificationcase.StatusValidator(status); err != nil {
		status = verificationcase.StatusUnderReview
	}
	limit := query.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := handler.Container.Client.VerificationCase.Query().Where(verificationcase.StatusEQ(status)).Order(ent.Asc(verificationcase.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]Item, 0, len(rows))
	for _, row := range rows {
		item := Item{CaseView: services.ConvertCaseToView(row, true)}
		if profile, err := handler.Container.Client.Profile.Get(ctx, row.ProfileID); err == nil {
			item.ProfileHandle, item.ProfileName = profile.Handle, profile.DisplayName
		}
		items = append(items, item)
	}
	return items, nil
}
