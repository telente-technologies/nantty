package admindeveloperops

import (
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type auditItem struct {
	ID               string    `json:"id"`
	OrganizationID   string    `json:"organizationId"`
	OrganizationName string    `json:"organizationName"`
	ActorAccountID   string    `json:"actorAccountId"`
	ActorRole        string    `json:"actorRole"`
	Action           string    `json:"action"`
	SubjectType      string    `json:"subjectType"`
	SubjectID        string    `json:"subjectId"`
	CreatedAt        time.Time `json:"createdAt"`
}

func (controller Controller) ListAudit(writer http.ResponseWriter, request *http.Request) {
	limit := 50
	if raw := strings.TrimSpace(request.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 100 {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_LIMIT", "limit must be between 1 and 100."))
			return
		}
		limit = parsed
	}
	query := `SELECT l.id::text, l.organization_id::text, o.name, l.actor_account_id::text, l.actor_role,
		l.action, l.subject_type, l.subject_id, l.created_at
		FROM developer_organization_audit_logs l
		JOIN developer_organizations o ON o.id = l.organization_id`
	args := []any{}
	if cursor := strings.TrimSpace(request.URL.Query().Get("cursor")); cursor != "" {
		decoded, err := base64.RawURLEncoding.DecodeString(cursor)
		parts := strings.SplitN(string(decoded), "\n", 2)
		if err != nil || len(parts) != 2 {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The audit cursor is invalid."))
			return
		}
		cursorTime, timeErr := time.Parse(time.RFC3339Nano, parts[0])
		cursorID, idErr := uuid.Parse(parts[1])
		if timeErr != nil || idErr != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The audit cursor is invalid."))
			return
		}
		args = append(args, cursorTime, cursorID)
		query += ` WHERE (l.created_at, l.id) < ($1::timestamptz, $2::uuid)`
	}
	query += ` ORDER BY l.created_at DESC, l.id DESC LIMIT $` + strconv.Itoa(len(args)+1)
	args = append(args, limit+1)
	rows, err := controller.Container.Database.QueryContext(request.Context(), query, args...)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := make([]auditItem, 0, limit+1)
	for rows.Next() {
		var item auditItem
		if err := rows.Scan(&item.ID, &item.OrganizationID, &item.OrganizationName, &item.ActorAccountID, &item.ActorRole, &item.Action, &item.SubjectType, &item.SubjectID, &item.CreatedAt); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var nextCursor string
	if len(items) > limit {
		last := items[limit-1]
		nextCursor = base64.RawURLEncoding.EncodeToString([]byte(last.CreatedAt.UTC().Format(time.RFC3339Nano) + "\n" + last.ID))
		items = items[:limit]
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"entries": items, "nextCursor": nextCursor})
}
