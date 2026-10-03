package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/session"
)

const sessionPageSize = 20

type ActiveSessionView struct {
	Id         string `json:"id"`
	UserAgent  string `json:"userAgent"`
	IpAddress  string `json:"ipAddress"`
	CreatedAt  string `json:"createdAt"`
	LastUsedAt string `json:"lastUsedAt"`
	Current    bool   `json:"current"`
}

type ActiveSessionsPage struct {
	Data       []ActiveSessionView `json:"data"`
	NextCursor *string             `json:"nextCursor"`
}

func (application *AuthApplication) ListActiveSessionsOfAccount(ctx context.Context, accountId, currentSessionId, cursor string) (ActiveSessionsPage, error) {
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return ActiveSessionsPage{}, errInvalidRefreshToken
	}
	now := application.Now()
	query := application.Client.Session.Query().
		Where(session.AccountID(owner), session.RevokedAtIsNil(), session.ExpiresAtGT(now), session.CreatedAtGT(now.Add(-application.Settings.SessionMaximumLifetime))).
		Order(ent.Desc(session.FieldID)).Limit(sessionPageSize + 1)
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return ActiveSessionsPage{}, unprocessable("The cursor is invalid.")
		}
		query = query.Where(session.IDLT(cursorId))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return ActiveSessionsPage{}, err
	}
	page := ActiveSessionsPage{Data: make([]ActiveSessionView, 0, len(rows))}
	if len(rows) > sessionPageSize {
		rows = rows[:sessionPageSize]
		next := rows[len(rows)-1].ID.String()
		page.NextCursor = &next
	}
	for _, row := range rows {
		page.Data = append(page.Data, ActiveSessionView{
			Id: row.ID.String(), UserAgent: row.UserAgent, IpAddress: row.IPAddress, Current: row.ID.String() == currentSessionId,
			CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), LastUsedAt: row.LastUsedAt.UTC().Format(time.RFC3339),
		})
	}
	return page, nil
}
