package auth_test

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/auth/src/container"
	production "nantty/modules/auth/src/modules/developerProduction"
)

func TestProductionMessageHistoryAndStatusAreTenantAndConsentScoped(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	schema := "business_history_" + uuid.NewString()[:8]
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.ExecContext(ctx, "DROP SCHEMA "+quotedSchema+" CASCADE"); err != nil {
			t.Errorf("drop test schema: %v", err)
		}
		if err := admin.Close(); err != nil {
			t.Errorf("close test database connection: %v", err)
		}
	})
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	db, err := sql.Open("pgx", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, statement := range []string{
		`CREATE TABLE developer_organizations (id uuid PRIMARY KEY)`,
		`CREATE TABLE developer_applications (id uuid PRIMARY KEY, status text NOT NULL)`,
		`CREATE TABLE developer_production_credentials (id uuid PRIMARY KEY, application_id uuid NOT NULL, organization_id uuid NOT NULL, status text NOT NULL, scopes jsonb NOT NULL, secret_hash text NOT NULL)`,
		`CREATE TABLE developer_billing_subscriptions (organization_id uuid PRIMARY KEY, plan_tier text NOT NULL, status text NOT NULL, monthly_quota bigint NOT NULL, current_period_end timestamptz, provider_reference text, payment_verified_at timestamptz)`,
		`CREATE TABLE developer_production_requests (id uuid PRIMARY KEY, application_id uuid NOT NULL, organization_id uuid NOT NULL, credential_id uuid NOT NULL, method text NOT NULL, path text NOT NULL, status_code integer NOT NULL, latency_ms integer NOT NULL, created_at timestamptz NOT NULL)`,
		`CREATE TABLE developer_business_consents (organization_id uuid NOT NULL, application_id uuid NOT NULL, recipient_account_id uuid NOT NULL, status text NOT NULL, scopes jsonb NOT NULL, granted_at timestamptz NOT NULL)`,
		`CREATE TABLE developer_business_authorizations (organization_id uuid NOT NULL, application_id uuid NOT NULL, store_id uuid NOT NULL, status text NOT NULL, scopes jsonb NOT NULL)`,
		`CREATE TABLE developer_business_messages (id uuid PRIMARY KEY, organization_id uuid NOT NULL, application_id uuid NOT NULL, credential_id uuid, store_id uuid, recipient_account_id uuid NOT NULL, body_text text NOT NULL, status text NOT NULL, external_message_id text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL)`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}

	orgID, appID, otherAppID, credentialID, storeID := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	recipientID := uuid.New()
	token := "ntlive_" + uuid.NewString()
	hash := sha256.Sum256([]byte(token))
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_organizations VALUES ($1)`, orgID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_applications VALUES ($1, 'approved'), ($2, 'approved')`, appID, otherAppID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_production_credentials VALUES ($1,$2,$3,'active','["messages:read","conversations:read"]'::jsonb,$4)`, credentialID, appID, orgID, fmt.Sprintf("%x", hash)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_billing_subscriptions VALUES ($1,'starter','active',100,now() + interval '1 month','verified-reference',now())`, orgID); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Microsecond)
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_consents VALUES ($1,$2,$3,'active','["messages:read","conversations:read"]'::jsonb,$4)`, orgID, appID, recipientID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_authorizations VALUES ($1,$2,$3,'active','["messages:read","conversations:read"]'::jsonb)`, orgID, appID, storeID); err != nil {
		t.Fatal(err)
	}
	newerRecipientID, newestRecipientID, noConversationScopeID := uuid.New(), uuid.New(), uuid.New()
	for _, row := range []struct {
		id      uuid.UUID
		granted time.Time
		scopes  string
	}{
		{id: newerRecipientID, granted: now.Add(3 * time.Second), scopes: `["conversations:read","messages:read"]`},
		{id: newestRecipientID, granted: now.Add(4 * time.Second), scopes: `["conversations:read","messages:read"]`},
		{id: noConversationScopeID, granted: now.Add(5 * time.Second), scopes: `["messages:read"]`},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_consents VALUES ($1,$2,$3,'active',$4::jsonb,$5)`, orgID, appID, row.id, row.scopes, row.granted); err != nil {
			t.Fatal(err)
		}
	}
	for index, row := range []struct {
		id      uuid.UUID
		created time.Time
	}{
		{id: newerRecipientID, created: now.Add(4 * time.Second)},
		{id: newestRecipientID, created: now.Add(5 * time.Second)},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_messages (id, organization_id, application_id, credential_id, store_id, recipient_account_id, body_text, status, external_message_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'dispatched',$8,$9,$9)`, uuid.New(), orgID, appID, credentialID, storeID, row.id, fmt.Sprintf("conversation-%d", index+1), fmt.Sprintf("external-conversation-%d", index+1), row.created); err != nil {
			t.Fatal(err)
		}
	}
	messageIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New()}
	for index, messageID := range messageIDs {
		if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_messages VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, messageID, orgID, appID, credentialID, storeID, recipientID, fmt.Sprintf("message-%d", index+1), "dispatched", fmt.Sprintf("external-%d", index+1), now.Add(time.Duration(index)*time.Second)); err != nil {
			t.Fatal(err)
		}
	}
	foreignMessageID := uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_messages VALUES ($1,$2,$3,$4,$5,$6,'private-other-app','dispatched','external-other',now(),now())`, foreignMessageID, orgID, otherAppID, credentialID, storeID, recipientID); err != nil {
		t.Fatal(err)
	}
	legacyUnscopedMessageID := uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_messages VALUES ($1,$2,$3,$4,NULL,$5,'legacy-unscoped','dispatched','external-legacy',now(),now())`, legacyUnscopedMessageID, orgID, appID, credentialID, recipientID); err != nil {
		t.Fatal(err)
	}
	controller := production.Controller{Container: &container.Container{Database: db, Logger: slog.New(slog.NewTextHandler(os.Stderr, nil))}}

	historyRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/conversations/"+recipientID.String()+"/messages?storeId="+storeID.String()+"&limit=2", nil)
	historyRequest.Header.Set("Authorization", "Bearer "+token)
	historyRequest.SetPathValue("recipientId", recipientID.String())
	historyResponse := httptest.NewRecorder()
	controller.ListBusinessMessages(historyResponse, historyRequest)
	if historyResponse.Code != http.StatusOK {
		t.Fatalf("history returned %d: %s", historyResponse.Code, historyResponse.Body.String())
	}
	var history struct {
		Messages   []production.BusinessMessageView `json:"messages"`
		NextCursor *string                          `json:"nextCursor"`
	}
	if err := json.Unmarshal(historyResponse.Body.Bytes(), &history); err != nil {
		t.Fatal(err)
	}
	if len(history.Messages) != 2 || history.Messages[0].Text != "message-2" || history.Messages[1].Text != "message-3" || history.NextCursor == nil {
		t.Fatalf("unexpected first page: %+v", history)
	}

	nextRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/conversations/"+recipientID.String()+"/messages?storeId="+storeID.String()+"&limit=2&cursor="+url.QueryEscape(*history.NextCursor), nil)
	nextRequest.Header.Set("Authorization", "Bearer "+token)
	nextRequest.SetPathValue("recipientId", recipientID.String())
	nextResponse := httptest.NewRecorder()
	controller.ListBusinessMessages(nextResponse, nextRequest)
	if nextResponse.Code != http.StatusOK {
		t.Fatalf("next history page returned %d: %s", nextResponse.Code, nextResponse.Body.String())
	}
	if err := json.Unmarshal(nextResponse.Body.Bytes(), &history); err != nil {
		t.Fatal(err)
	}
	if len(history.Messages) != 1 || history.Messages[0].Text != "message-1" || history.NextCursor != nil {
		t.Fatalf("unexpected next page: %+v", history)
	}

	statusRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/messages/"+messageIDs[0].String(), nil)
	statusRequest.Header.Set("Authorization", "Bearer "+token)
	statusRequest.SetPathValue("messageId", messageIDs[0].String())
	statusResponse := httptest.NewRecorder()
	controller.GetBusinessMessageStatus(statusResponse, statusRequest)
	if statusResponse.Code != http.StatusOK || !strings.Contains(statusResponse.Body.String(), `"status":"dispatched"`) {
		t.Fatalf("status returned %d: %s", statusResponse.Code, statusResponse.Body.String())
	}
	foreignRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/messages/"+foreignMessageID.String(), nil)
	foreignRequest.Header.Set("Authorization", "Bearer "+token)
	foreignRequest.SetPathValue("messageId", foreignMessageID.String())
	foreignResponse := httptest.NewRecorder()
	controller.GetBusinessMessageStatus(foreignResponse, foreignRequest)
	if foreignResponse.Code != http.StatusNotFound {
		t.Fatalf("cross-application status read returned %d, want 404: %s", foreignResponse.Code, foreignResponse.Body.String())
	}
	legacyStatusRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/messages/"+legacyUnscopedMessageID.String(), nil)
	legacyStatusRequest.Header.Set("Authorization", "Bearer "+token)
	legacyStatusRequest.SetPathValue("messageId", legacyUnscopedMessageID.String())
	legacyStatusResponse := httptest.NewRecorder()
	controller.GetBusinessMessageStatus(legacyStatusResponse, legacyStatusRequest)
	if legacyStatusResponse.Code != http.StatusNotFound {
		t.Fatalf("legacy message without store attribution returned %d, want 404: %s", legacyStatusResponse.Code, legacyStatusResponse.Body.String())
	}

	conversationRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/conversations?storeId="+storeID.String()+"&limit=2", nil)
	conversationRequest.Header.Set("Authorization", "Bearer "+token)
	conversationResponse := httptest.NewRecorder()
	controller.ListBusinessConversations(conversationResponse, conversationRequest)
	if conversationResponse.Code != http.StatusOK {
		t.Fatalf("conversation listing returned %d: %s", conversationResponse.Code, conversationResponse.Body.String())
	}
	var conversations struct {
		Items      []production.BusinessConversationView `json:"conversations"`
		NextCursor *string                               `json:"nextCursor"`
	}
	if err := json.Unmarshal(conversationResponse.Body.Bytes(), &conversations); err != nil {
		t.Fatal(err)
	}
	if len(conversations.Items) != 2 || conversations.Items[0].RecipientID != newestRecipientID.String() || conversations.Items[1].RecipientID != newerRecipientID.String() || conversations.NextCursor == nil {
		t.Fatalf("unexpected first conversation page: %+v", conversations)
	}
	conversationPageRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/conversations?storeId="+storeID.String()+"&limit=2&cursor="+url.QueryEscape(*conversations.NextCursor), nil)
	conversationPageRequest.Header.Set("Authorization", "Bearer "+token)
	conversationPageResponse := httptest.NewRecorder()
	controller.ListBusinessConversations(conversationPageResponse, conversationPageRequest)
	if conversationPageResponse.Code != http.StatusOK {
		t.Fatalf("next conversation page returned %d: %s", conversationPageResponse.Code, conversationPageResponse.Body.String())
	}
	if err := json.Unmarshal(conversationPageResponse.Body.Bytes(), &conversations); err != nil {
		t.Fatal(err)
	}
	if len(conversations.Items) != 1 || conversations.Items[0].RecipientID != recipientID.String() || conversations.NextCursor != nil {
		t.Fatalf("unexpected next conversation page: %+v", conversations)
	}
	unauthorizedStoreRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/conversations?storeId="+uuid.NewString(), nil)
	unauthorizedStoreRequest.Header.Set("Authorization", "Bearer "+token)
	unauthorizedStoreResponse := httptest.NewRecorder()
	controller.ListBusinessConversations(unauthorizedStoreResponse, unauthorizedStoreRequest)
	if unauthorizedStoreResponse.Code != http.StatusForbidden {
		t.Fatalf("ungranted store conversation read returned %d, want 403: %s", unauthorizedStoreResponse.Code, unauthorizedStoreResponse.Body.String())
	}
	storeWithoutReadID := uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO developer_business_authorizations VALUES ($1,$2,$3,'active','["conversations:read"]'::jsonb)`, orgID, appID, storeWithoutReadID); err != nil {
		t.Fatal(err)
	}
	storeWithoutReadRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/conversations/"+recipientID.String()+"/messages?storeId="+storeWithoutReadID.String(), nil)
	storeWithoutReadRequest.Header.Set("Authorization", "Bearer "+token)
	storeWithoutReadRequest.SetPathValue("recipientId", recipientID.String())
	storeWithoutReadResponse := httptest.NewRecorder()
	controller.ListBusinessMessages(storeWithoutReadResponse, storeWithoutReadRequest)
	if storeWithoutReadResponse.Code != http.StatusForbidden {
		t.Fatalf("store without messages:read returned %d, want 403: %s", storeWithoutReadResponse.Code, storeWithoutReadResponse.Body.String())
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_business_authorizations SET scopes = '["conversations:read"]'::jsonb WHERE organization_id = $1 AND application_id = $2 AND store_id = $3`, orgID, appID, storeID); err != nil {
		t.Fatal(err)
	}
	statusWithoutStoreGrantRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/messages/"+messageIDs[0].String(), nil)
	statusWithoutStoreGrantRequest.Header.Set("Authorization", "Bearer "+token)
	statusWithoutStoreGrantRequest.SetPathValue("messageId", messageIDs[0].String())
	statusWithoutStoreGrantResponse := httptest.NewRecorder()
	controller.GetBusinessMessageStatus(statusWithoutStoreGrantResponse, statusWithoutStoreGrantRequest)
	if statusWithoutStoreGrantResponse.Code != http.StatusNotFound {
		t.Fatalf("message status without store messages:read grant returned %d, want 404: %s", statusWithoutStoreGrantResponse.Code, statusWithoutStoreGrantResponse.Body.String())
	}
	if _, err := db.ExecContext(ctx, `UPDATE developer_business_consents SET status = 'revoked' WHERE organization_id = $1 AND application_id = $2 AND recipient_account_id = $3`, orgID, appID, recipientID); err != nil {
		t.Fatal(err)
	}
	revokedRequest := httptest.NewRequest(http.MethodGet, "/api/v1/business/messages/"+messageIDs[0].String(), nil)
	revokedRequest.Header.Set("Authorization", "Bearer "+token)
	revokedRequest.SetPathValue("messageId", messageIDs[0].String())
	revokedResponse := httptest.NewRecorder()
	controller.GetBusinessMessageStatus(revokedResponse, revokedRequest)
	if revokedResponse.Code != http.StatusNotFound {
		t.Fatalf("revoked-consent status read returned %d, want 404: %s", revokedResponse.Code, revokedResponse.Body.String())
	}
}
