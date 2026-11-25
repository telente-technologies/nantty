package developerproduction

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type BusinessConversationView struct {
	RecipientID   string     `json:"recipientId"`
	GrantedAt     time.Time  `json:"grantedAt"`
	LastStatus    string     `json:"lastStatus"`
	LastMessageAt *time.Time `json:"lastMessageAt,omitempty"`
}

func (controller Controller) ListBusinessConversations(writer http.ResponseWriter, request *http.Request) {
	started := time.Now()
	limit, err := ParseBusinessPageSize(request.URL.Query())
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var cursor *BusinessApiCursor
	if rawCursor := request.URL.Query().Get("cursor"); rawCursor != "" {
		decoded, err := DecodeBusinessApiCursor(rawCursor)
		if err != nil || decoded.Kind != "conversation" {
			if err == nil {
				err = httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor does not belong to a conversation listing.")
			}
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		cursor = &decoded
	}
	credentialID, applicationID, organizationID, err := controller.authenticateLiveCredential(request, "conversations:read")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	storeID, err := parseBusinessStoreID(request.URL.Query().Get("storeId"))
	if err == nil {
		err = requireBusinessStoreCapability(request.Context(), controller.Container.Database, organizationID, applicationID, storeID, "conversations:read")
	}
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	requestID, err := ReserveProductionRequest(request.Context(), controller.Container.Database, organizationID, applicationID, credentialID, http.MethodGet, "/api/v1/business/conversations")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var cursorTime, cursorID any
	if cursor != nil {
		cursorTime = cursor.CreatedAt
		cursorID = cursor.ResourceID
	}
	rows, err := controller.Container.Database.QueryContext(request.Context(),
		`WITH conversation_rows AS (
			SELECT c.recipient_account_id, c.granted_at,
			       COALESCE(latest.created_at, c.granted_at) AS sort_at,
			       COALESCE(latest.status, 'consented') AS last_status,
			       latest.created_at AS last_message_at
			FROM developer_business_consents c
			JOIN LATERAL (
				SELECT m.status, m.created_at
				FROM developer_business_messages m
				WHERE m.organization_id = c.organization_id
				  AND m.application_id = c.application_id
				  AND m.recipient_account_id = c.recipient_account_id
				  AND m.store_id = $3
				ORDER BY m.created_at DESC, m.id DESC
				LIMIT 1
			) latest ON true
			WHERE c.organization_id = $1 AND c.application_id = $2
			  AND c.status = 'active' AND c.scopes ? 'conversations:read'
		)
		SELECT recipient_account_id, granted_at, last_status, last_message_at, sort_at
		FROM conversation_rows
		WHERE $4::timestamptz IS NULL OR (sort_at, recipient_account_id) < ($4::timestamptz, $5::uuid)
		ORDER BY sort_at DESC, recipient_account_id DESC
		LIMIT $6`,
		organizationID, applicationID, storeID, cursorTime, cursorID, limit+1,
	)
	if err != nil {
		completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusInternalServerError, started)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	type conversationRow struct {
		item   BusinessConversationView
		id     uuid.UUID
		sortAt time.Time
	}
	items := make([]conversationRow, 0, limit+1)
	for rows.Next() {
		var row conversationRow
		var lastMessageAt sql.NullTime
		if err := rows.Scan(&row.id, &row.item.GrantedAt, &row.item.LastStatus, &lastMessageAt, &row.sortAt); err != nil {
			completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusInternalServerError, started)
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		row.item.RecipientID = row.id.String()
		if lastMessageAt.Valid {
			row.item.LastMessageAt = &lastMessageAt.Time
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusInternalServerError, started)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusOK, started)
	var nextCursor *string
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1]
		encoded := EncodeBusinessApiCursor(BusinessApiCursor{Kind: "conversation", CreatedAt: last.sortAt, ResourceID: last.id})
		nextCursor = &encoded
	}
	conversations := make([]BusinessConversationView, len(items))
	for index, item := range items {
		conversations[index] = item.item
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"conversations": conversations, "nextCursor": nextCursor})
}
