package developerproduction

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func (controller Controller) authenticateLiveCredential(request *http.Request, requiredScope string) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	token := jwtauth.ExtractBearerTokenFromAuthorizationHeader(request)
	if !strings.HasPrefix(token, "ntlive_") {
		return uuid.Nil, uuid.Nil, uuid.Nil, httpserver.ErrUnauthorized
	}
	var credId, appId, orgId uuid.UUID
	var appStatus, credStatus string
	var scopesRaw []byte
	err := controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT c.id, c.application_id, c.organization_id, c.status, a.status, c.scopes
		 FROM developer_production_credentials c
		 JOIN developer_applications a ON a.id = c.application_id
		 WHERE c.secret_hash = $1`, Sha256Hex(token),
	).Scan(&credId, &appId, &orgId, &credStatus, &appStatus, &scopesRaw)
	if err == sql.ErrNoRows {
		return uuid.Nil, uuid.Nil, uuid.Nil, httpserver.ErrUnauthorized
	}
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, err
	}
	if credStatus != "active" {
		return uuid.Nil, uuid.Nil, uuid.Nil, httpserver.ErrUnauthorized
	}
	if appStatus != "approved" {
		return uuid.Nil, uuid.Nil, uuid.Nil, httpserver.NewApiError(http.StatusForbidden, "APPLICATION_NOT_APPROVED", "Production API access is suspended or unapproved.")
	}
	var scopes []string
	_ = json.Unmarshal(scopesRaw, &scopes)
	if requiredScope != "" && !slices.Contains(scopes, requiredScope) {
		return uuid.Nil, uuid.Nil, uuid.Nil, httpserver.NewApiError(http.StatusForbidden, "INSUFFICIENT_SCOPE", "Credential lacks required scope: "+requiredScope)
	}
	return credId, appId, orgId, nil
}

func (controller Controller) SendBusinessMessage(writer http.ResponseWriter, request *http.Request) {
	started := time.Now()
	credId, appId, orgId, err := controller.authenticateLiveCredential(request, "messages:send")
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var body struct {
		StoreId     string `json:"storeId"`
		RecipientId string `json:"recipientId"`
		Text        string `json:"text"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	recipientUUID, err := uuid.Parse(strings.TrimSpace(body.RecipientId))
	storeUUID, storeErr := parseBusinessStoreID(body.StoreId)
	text := strings.TrimSpace(body.Text)
	if err != nil || storeErr != nil || text == "" || utf8.RuneCountInString(text) > 4000 {
		if storeErr != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, storeErr)
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_MESSAGE", "Valid storeId, recipientId UUID and text (1-4000 chars) are required."))
		return
	}
	if err := requireBusinessStoreCapability(request.Context(), controller.Container.Database, orgId, appId, storeUUID, "messages:send"); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var scopesRaw []byte
	err = controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT scopes FROM developer_business_consents WHERE organization_id = $1 AND application_id = $2 AND store_id = $3 AND recipient_account_id = $4 AND status = 'active'`,
		orgId, appId, storeUUID, recipientUUID,
	).Scan(&scopesRaw)
	if err == sql.ErrNoRows {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusForbidden, "BUSINESS_CONSENT_REQUIRED", "Recipient has not granted active messaging consent to this application."))
		return
	}
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	var consentScopes []string
	_ = json.Unmarshal(scopesRaw, &consentScopes)
	if !slices.Contains(consentScopes, "messages:send") {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusForbidden, "BUSINESS_CONSENT_REQUIRED", "Active consent does not include messages:send."))
		return
	}
	dispatchUrl := strings.TrimRight(strings.TrimSpace(os.Getenv("BUSINESS_MESSAGING_INTERNAL_URL")), "/")
	dispatchToken := strings.TrimSpace(os.Getenv("BUSINESS_MESSAGING_INTERNAL_TOKEN"))
	if dispatchUrl == "" || dispatchToken == "" {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusServiceUnavailable, "BUSINESS_MESSAGING_DISPATCH_UNAVAILABLE", "Business messaging delivery gateway is not configured."))
		return
	}
	reservation, err := ReserveProductionMessage(request.Context(), controller.Container.Database, orgId, appId, credId, storeUUID, recipientUUID, request.Header.Get("Idempotency-Key"), text, controller.Container.Now().UTC())
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	msgId := reservation.MessageId
	if reservation.Replay {
		if reservation.Status == "dispatched" {
			httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"messageId": msgId.String(), "externalMessageId": reservation.ExternalMessageId, "status": "dispatched"})
			return
		}
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger,
			httpserver.NewApiError(http.StatusConflict, "MESSAGE_STATUS_UNCERTAIN", "The original message is pending or its delivery status is uncertain.").WithDetails(map[string]any{"messageId": msgId.String(), "status": reservation.Status}))
		return
	}
	requestId := reservation.RequestId
	extId, dispatchErr := dispatchBusinessMessage(request.Context(), dispatchUrl, dispatchToken, msgId, orgId, appId, storeUUID, recipientUUID, text)
	if dispatchErr != nil {
		completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestId, http.StatusServiceUnavailable, started)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger,
			httpserver.NewApiError(http.StatusServiceUnavailable, "MESSAGE_STATUS_UNCERTAIN", "Message delivery could not be confirmed. Do not resend until this message is reconciled.").WithDetails(map[string]any{"messageId": msgId.String()}))
		return
	}
	if err := ConfirmProductionMessageDispatchWithWebhookOutbox(
		request.Context(), controller.Container.Database, msgId, appId, orgId, extId,
		map[string]any{"messageId": msgId.String(), "recipientId": recipientUUID.String(), "status": "dispatched", "externalMessageId": extId},
		controller.Container.Now().UTC(),
	); err != nil {
		completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestId, http.StatusServiceUnavailable, started)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger,
			httpserver.NewApiError(http.StatusServiceUnavailable, "MESSAGE_STATUS_UNCERTAIN", "Message delivery was accepted but its status could not be saved. Do not resend until this message is reconciled.").WithDetails(map[string]any{"messageId": msgId.String()}))
		return
	}
	completeProductionRequest(request.Context(), controller.Container.Database, controller.Container.Logger, requestId, http.StatusAccepted, started)
	_, _ = controller.Container.Database.ExecContext(request.Context(), `UPDATE developer_production_credentials SET last_used_at = now() WHERE id = $1`, credId)
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, map[string]any{"messageId": msgId.String(), "externalMessageId": extId, "status": "dispatched"})
}

func dispatchBusinessMessage(ctx context.Context, baseUrl, token string, msgId, orgId, appId, storeId, recipientId uuid.UUID, text string) (string, error) {
	encoded, _ := json.Marshal(map[string]string{
		"messageId": msgId.String(), "organizationId": orgId.String(), "applicationId": appId.String(), "storeId": storeId.String(), "recipientId": recipientId.String(), "text": text,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseUrl+"/api/v1/internal/business/messages", bytes.NewReader(encoded))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", token)
	resp, err := NewInternalServiceHTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", httpserver.NewApiError(http.StatusBadGateway, "UPSTREAM_ERROR", "messaging service returned non-2xx")
	}
	var out struct {
		ExternalMessageId string `json:"externalMessageId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || strings.TrimSpace(out.ExternalMessageId) == "" {
		return "", httpserver.NewApiError(http.StatusBadGateway, "INVALID_UPSTREAM_RESPONSE", "Messaging service did not confirm a message identifier.")
	}
	return out.ExternalMessageId, nil
}
