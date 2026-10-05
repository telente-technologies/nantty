package listwithheldusernames

import (
	"context"
	"time"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/usernamehold"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	"zudomart/platform/identityports"
)

const listLimit = 200

type Result struct {
	Data       []services.WithheldUsernameView `json:"data"`
	NextCursor *string                         `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (Result, error) {
	rows, err := handler.Container.Client.UsernameHold.Query().Where(usernamehold.KindEQ(usernamehold.KindWithheld)).Order(ent.Desc(usernamehold.FieldID)).Limit(listLimit).All(ctx)
	if err != nil {
		return Result{}, err
	}
	directory, _ := identityports.Default.AccountDirectory()
	result := Result{Data: make([]services.WithheldUsernameView, 0, len(rows))}
	for _, row := range rows {
		view := services.WithheldUsernameView{Username: row.Username, WithheldAt: row.CreatedAt.UTC().Format(time.RFC3339), WithheldByName: row.CreatedByName, Reason: row.Reason}
		if row.HeldForAccountID != nil {
			view.OriginalOwnerId = row.HeldForAccountID.String()
			if directory != nil {
				if owner, found, err := directory.FindAccountSummary(ctx, *row.HeldForAccountID); err == nil && found {
					view.OriginalOwnerDisplayName = owner.Name
				}
			}
		}
		result.Data = append(result.Data, view)
	}
	return result, nil
}
