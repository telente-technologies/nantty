package listheldusernames

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/usernamehold"
)

type Hold struct {
	Username    string  `json:"username"`
	ReleasedAt  *string `json:"releasedAt"`
	AvailableAt *string `json:"availableAt"`
	IsHeld      bool    `json:"isHeld"`
}

type Result struct {
	Items      []Hold  `json:"items"`
	Data       []Hold  `json:"data"`
	NextCursor *string `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func HoldView(row *ent.UsernameHold, now time.Time) Hold {
	released := row.CreatedAt.UTC().Format(time.RFC3339)
	view := Hold{Username: row.Username, ReleasedAt: &released, IsHeld: row.ExpiresAt == nil || row.ExpiresAt.After(now)}
	if row.ExpiresAt != nil {
		available := row.ExpiresAt.UTC().Format(time.RFC3339)
		view.AvailableAt = &available
	}
	return view
}

func (handler Handler) Execute(ctx context.Context) (Result, error) {
	now := handler.Container.Now()
	rows, err := handler.Container.Client.UsernameHold.Query().Where(usernamehold.KindEQ(usernamehold.KindQuarantine), usernamehold.ExpiresAtGT(now)).Order(ent.Asc(usernamehold.FieldExpiresAt)).Limit(500).All(ctx)
	holds := make([]Hold, 0, len(rows))
	for _, row := range rows {
		holds = append(holds, HoldView(row, now))
	}
	return Result{Items: holds, Data: holds}, err
}
