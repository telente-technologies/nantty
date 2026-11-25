package developerproduction

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type BusinessMessageView struct {
	MessageID         string    `json:"messageId"`
	RecipientID       string    `json:"recipientId"`
	Text              string    `json:"text"`
	Status            string    `json:"status"`
	ExternalMessageID *string   `json:"externalMessageId,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

func (controller Controller) authorizeBusinessMessageRead(request *http.Request, recipientID uuid.UUID) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	credentialID, applicationID, organizationID, err := controller.authenticateLiveCredential(request, "messages:read")
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, err
	}
	var rawScopes []byte
	err = controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT scopes FROM developer_business_consents
		 WHERE organization_id = $1 AND application_id = $2 AND recipient_account_id = $3 AND status = 'active'`,
		organizationID, applicationID, recipientID,
	).Scan(&rawScopes)
	if err == sql.ErrNoRows {
		return uuid.Nil, uuid.Nil, uuid.Nil, httpserver.NewApiError(http.StatusForbidden, "BUSINESS_CONSENT_REQUIRED", "The recipient has not granted active messages:read consent to this application.")
	}
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, err
	}
	var consentScopes []string
	if err := jsonUnmarshalScopes(rawScopes, &consentScopes); err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, err
	}
	if !slices.Contains(consentScopes, "messages:read") {
		return uuid.Nil, uuid.Nil, uuid.Nil, httpserver.NewApiError(http.StatusForbidden, "BUSINESS_CONSENT_REQUIRED", "Active consent does not include messages:read.")
	}
	return credentialID, applicationID, organizationID, nil
}

func (controller Controller) ListBusinessMessages(writer http.ResponseWriter, request *http.Request) {
	started := time.Now()
	recipientID, err := uuid.Parse(request.PathValue("recipientId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_RECIPIENT_ID", "Invalid recipient ID."))
		return
	}
	limit, err := ParseBusinessPageSize(request.URL.Query())
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	credentialID, applicationID, organizationID, err := controller.authorizeBusinessMessageRead(request, recipientID)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var cursor *BusinessApiCursor
	if rawCursor := request.URL.Query().Get("cursor"); rawCursor != "" {
		decoded, err := DecodeBusinessApiCursor(rawCursor)
		if err != nil || decoded.Kind != "message" {
			if err == nil {
				err = httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor does not belong to a message history.")
			}
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		cursor = &decoded
	}
	requestID, err := ReserveProductionRequest(request.Context(), controller.Container.Database, organizationID, applicationID, credentialID, http.MethodGet, "/api/v1/business/conversations/{recipientId}/messages")
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
		`SELECT m.id, m.recipient_account_id, m.body_text, m.status, m.external_message_id, m.created_at, m.updated_at
		 FROM developer_business_messages m
		 WHERE m.organization_id = $1 AND m.application_id = $2 AND m.recipient_account_id = $3
		   AND EXISTS (SELECT 1 FROM developer_business_consents c
		               WHERE c.organization_id = m.organization_id
		                 AND c.application_id = m.application_id
		                 AND c.recipient_account_id = m.recipient_account_id
		                 AND c.status = 'active' AND c.scopes ? 'messages:read')
		   AND ($4::timestamptz IS NULL OR (m.created_at, m.id) < ($4::timestamptz, $5::uuid))
		 ORDER BY m.created_at DESC, m.id DESC LIMIT $6`,
		organizationID, applicationID, recipientID, cursorTime, cursorID, limit+1,
	)
	if err != nil {
		completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusInternalServerError, started)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := make([]BusinessMessageView, 0, limit+1)
	for rows.Next() {
		var item BusinessMessageView
		var messageID, rowRecipientID uuid.UUID
		var externalID sql.NullString
		if err := rows.Scan(&messageID, &rowRecipientID, &item.Text, &item.Status, &externalID, &item.CreatedAt, &item.UpdatedAt); err != nil {
			completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusInternalServerError, started)
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		item.MessageID = messageID.String()
		item.RecipientID = rowRecipientID.String()
		if externalID.Valid {
			item.ExternalMessageID = &externalID.String
		}
		items = append(items, item)
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
		oldest := items[len(items)-1]
		messageID, _ := uuid.Parse(oldest.MessageID)
		encoded := EncodeBusinessApiCursor(BusinessApiCursor{Kind: "message", CreatedAt: oldest.CreatedAt, ResourceID: messageID})
		nextCursor = &encoded
	}
	for left, right := 0, len(items)-1; left < right; left, right = left+1, right-1 {
		items[left], items[right] = items[right], items[left]
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"messages": items, "nextCursor": nextCursor})
}

func (controller Controller) GetBusinessMessageStatus(writer http.ResponseWriter, request *http.Request) {
	started := time.Now()
	messageID, err := uuid.Parse(request.PathValue("messageId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_MESSAGE_ID", "Invalid message ID."))
		return
	}
	credentialID, applicationID, organizationID, err := controller.authenticateLiveCredential(request, "messages:read")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	requestID, err := ReserveProductionRequest(request.Context(), controller.Container.Database, organizationID, applicationID, credentialID, http.MethodGet, "/api/v1/business/messages/{messageId}")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var item BusinessMessageView
	var id, recipientID uuid.UUID
	var externalID sql.NullString
	err = controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT m.id, m.recipient_account_id, m.body_text, m.status, m.external_message_id, m.created_at, m.updated_at
		 FROM developer_business_messages m
		 WHERE m.id = $1 AND m.organization_id = $2 AND m.application_id = $3
		   AND EXISTS (SELECT 1 FROM developer_business_consents c
		               WHERE c.organization_id = m.organization_id AND c.application_id = m.application_id
		                 AND c.recipient_account_id = m.recipient_account_id AND c.status = 'active'
		                 AND c.scopes ? 'messages:read')`,
		messageID, organizationID, applicationID,
	).Scan(&id, &recipientID, &item.Text, &item.Status, &externalID, &item.CreatedAt, &item.UpdatedAt)
	if err == sql.ErrNoRows {
		completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusNotFound, started)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "MESSAGE_NOT_FOUND", "Message was not found."))
		return
	}
	if err != nil {
		completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusInternalServerError, started)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	item.MessageID = id.String()
	item.RecipientID = recipientID.String()
	if externalID.Valid {
		item.ExternalMessageID = &externalID.String
	}
	completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestID, http.StatusOK, started)
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"message": item})
}

func jsonUnmarshalScopes(raw []byte, scopes *[]string) error {
	if err := json.Unmarshal(raw, scopes); err != nil {
		return httpserver.NewApiError(http.StatusInternalServerError, "CONSENT_DATA_INVALID", "The recipient consent record is invalid.")
	}
	return nil
}
