package listactivesessions

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/session"
)

const sessionPageSize = 20

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, query Query) (Page, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return Page{}, authErrors.ErrInvalidRefreshToken
	}
	now := application.Now()
	sessionQuery := application.Client.Session.Query().
		Where(session.AccountID(owner), session.RevokedAtIsNil(), session.ExpiresAtGT(now), session.CreatedAtGT(now.Add(-application.Settings.SessionMaximumLifetime))).
		Order(ent.Desc(session.FieldID)).Limit(sessionPageSize + 1)
	if query.Cursor != "" {
		cursorId, err := uuid.Parse(query.Cursor)
		if err != nil {
			return Page{}, authErrors.Unprocessable("The cursor is invalid.")
		}
		sessionQuery = sessionQuery.Where(session.IDLT(cursorId))
	}
	rows, err := sessionQuery.All(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{Data: make([]ActiveSessionView, 0, len(rows))}
	if len(rows) > sessionPageSize {
		rows = rows[:sessionPageSize]
		next := rows[len(rows)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range rows {
		page.Data = append(page.Data, ActiveSessionView{
			Id: row.ID.String(), UserAgent: row.UserAgent, IpAddress: row.IPAddress, Current: row.ID.String() == query.CurrentSessionId,
			CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), LastUsedAt: row.LastUsedAt.UTC().Format(time.RFC3339),
		})
	}
	return page, nil
}
