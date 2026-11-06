package controllers

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

const maxSpaceInvitationPageSize = 100

type spaceInvitationCursor struct {
	AccountID    string    `json:"accountId"`
	InvitedAt    time.Time `json:"invitedAt"`
	SpaceID      string    `json:"spaceId"`
	InvitationID string    `json:"invitationId"`
}

type spaceInvitationSummary struct {
	SpaceID      string               `json:"spaceId"`
	InvitationID string               `json:"invitationId"`
	Role         string               `json:"role"`
	Title        string               `json:"title,omitempty"`
	InvitedAt    time.Time            `json:"invitedAt"`
	InviterID    string               `json:"inviterId"`
	Space        spaceSummaryResponse `json:"space"`
}

type pendingSpaceInvitationRow struct {
	spaceID, hostID                uuid.UUID
	title, description, state      string
	visibility                     string
	metadata                       []byte
	scheduledAt, startedAt         *time.Time
	listeners                      int
	invitationID, role, stageTitle string
	invitedAt                      time.Time
}

const pendingSpaceInvitationsQuery = `
WITH matched AS (
	SELECT s.id AS space_id, s.host_id, s.title, s.description, s.state, s.visibility,
	       s.metadata, s.scheduled_at, s.started_at, s.listeners,
	       invitation->>'id' AS invitation_id, invitation->>'role' AS role,
	       COALESCE(invitation->>'title', '') AS stage_title,
	       CASE WHEN pg_input_is_valid(invitation->>'invitedAt', 'timestamptz')
	            THEN (invitation->>'invitedAt')::timestamptz END AS invited_at
	FROM spaces AS s
	CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN jsonb_typeof(s.metadata->'spaceInvitations') = 'array'
		     THEN s.metadata->'spaceInvitations' ELSE '[]'::jsonb END
	) AS invitation
	WHERE s.moderation_visibility = 'visible'
	  AND s.state IN ('scheduled', 'live')
	  AND s.metadata->'spaceInvitations' @> jsonb_build_array(
		jsonb_build_object('accountId', $1::text, 'status', 'pending')
	  )
	  AND invitation->>'accountId' = $1::text
	  AND invitation->>'status' = 'pending'
	  AND pg_input_is_valid(invitation->>'id', 'uuid')
)
SELECT space_id, host_id, title, description, state, visibility,
       metadata, scheduled_at, started_at, listeners, invitation_id, role, stage_title, invited_at
FROM matched
WHERE invited_at IS NOT NULL
  AND ($2::timestamptz IS NULL
       OR (invited_at, space_id, invitation_id) < ($2::timestamptz, $3::uuid, $4::text))
ORDER BY invited_at DESC, space_id DESC, invitation_id DESC
LIMIT $5`

func (c SpacesController) ListMyInvitations(w http.ResponseWriter, r *http.Request) {
	actor, err := utils.ActorFrom(r)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	cursorToken, limit, err := utils.PageParameters(r, 30, maxSpaceInvitationPageSize)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	cursor, err := decodeSpaceInvitationCursor(cursorToken, actor.UserId)
	if err != nil {
		c.responder().Error(w, r, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "must be a valid cursor for this account"}}))
		return
	}

	rows, err := c.queryPendingSpaceInvitations(r, actor.UserId, cursor, limit+1)
	if err != nil {
		c.responder().Error(w, r, err)
		return
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	hostIDs := make([]uuid.UUID, 0, len(rows))
	seenHosts := make(map[uuid.UUID]struct{}, len(rows))
	for _, row := range rows {
		if _, exists := seenHosts[row.hostID]; !exists {
			seenHosts[row.hostID] = struct{}{}
			hostIDs = append(hostIDs, row.hostID)
		}
	}
	profiles := map[uuid.UUID]interfaces.Participant{}
	if c.Container.Directory != nil && len(hostIDs) > 0 {
		profiles, err = c.Container.Directory.LookupParticipants(r.Context(), hostIDs)
		if err != nil {
			c.responder().Error(w, r, err)
			return
		}
	}

	items := make([]spaceInvitationSummary, 0, len(rows))
	for _, row := range rows {
		visibility := row.visibility
		var metadata map[string]any
		if len(row.metadata) > 0 {
			if err := json.Unmarshal(row.metadata, &metadata); err != nil {
				c.responder().Error(w, r, fmt.Errorf("decode Space invitation metadata: %w", err))
				return
			}
		}
		if audience, _ := metadata["spaceAudiencePolicy"].(string); audience == "invite_only" {
			visibility = "invite_only"
		}
		items = append(items, spaceInvitationSummary{
			SpaceID: row.spaceID.String(), InvitationID: row.invitationID, Role: row.role, Title: row.stageTitle,
			InvitedAt: row.invitedAt, InviterID: row.hostID.String(),
			Space: spaceSummaryResponse{
				ID: row.spaceID.String(), Title: row.title, Description: row.description, State: space.State(row.state),
				ScheduledAt: row.scheduledAt, StartedAt: row.startedAt, ListenerCount: row.listeners, Visibility: visibility,
				Host: describeSpacePerson(row.hostID, "host", false, profiles),
			},
		})
	}

	next := ""
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		next, err = encodeSpaceInvitationCursor(spaceInvitationCursor{
			AccountID: actor.UserId.String(), InvitedAt: last.invitedAt, SpaceID: last.spaceID.String(), InvitationID: last.invitationID,
		})
		if err != nil {
			c.responder().Error(w, r, err)
			return
		}
	}
	httpserver.WriteJsonResponse(w, http.StatusOK, httpserver.NewCursorPage(items, next))
}

func (c SpacesController) queryPendingSpaceInvitations(r *http.Request, accountID uuid.UUID, cursor *spaceInvitationCursor, limit int) ([]pendingSpaceInvitationRow, error) {
	var cursorAt any
	var cursorSpaceID any
	var cursorInvitationID any
	if cursor != nil {
		cursorAt, cursorSpaceID, cursorInvitationID = cursor.InvitedAt, cursor.SpaceID, cursor.InvitationID
	}
	rows, err := c.Container.Client.QueryContext(r.Context(), pendingSpaceInvitationsQuery,
		accountID.String(), cursorAt, cursorSpaceID, cursorInvitationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]pendingSpaceInvitationRow, 0, limit)
	for rows.Next() {
		var item pendingSpaceInvitationRow
		var scheduledAt, startedAt sql.NullTime
		if err := rows.Scan(&item.spaceID, &item.hostID, &item.title, &item.description, &item.state,
			&item.visibility, &item.metadata, &scheduledAt, &startedAt,
			&item.listeners, &item.invitationID, &item.role, &item.stageTitle, &item.invitedAt); err != nil {
			return nil, err
		}
		if scheduledAt.Valid {
			item.scheduledAt = &scheduledAt.Time
		}
		if startedAt.Valid {
			item.startedAt = &startedAt.Time
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func decodeSpaceInvitationCursor(token string, accountID uuid.UUID) (*spaceInvitationCursor, error) {
	if token == "" {
		return nil, nil
	}
	payload, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, err
	}
	var cursor spaceInvitationCursor
	if err := json.Unmarshal(payload, &cursor); err != nil {
		return nil, err
	}
	spaceID, spaceErr := uuid.Parse(cursor.SpaceID)
	invitationID, invitationErr := uuid.Parse(cursor.InvitationID)
	if cursor.AccountID != accountID.String() || cursor.InvitedAt.IsZero() || spaceErr != nil || invitationErr != nil ||
		spaceID == uuid.Nil || invitationID == uuid.Nil || spaceID.String() != cursor.SpaceID || invitationID.String() != cursor.InvitationID {
		return nil, fmt.Errorf("invalid invitation cursor")
	}
	return &cursor, nil
}

func encodeSpaceInvitationCursor(cursor spaceInvitationCursor) (string, error) {
	payload, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(payload), nil
}
