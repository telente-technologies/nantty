package developerproduction

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

var productionIdempotencyKey = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)

type MessageReservation struct {
	MessageId         uuid.UUID
	RequestId         uuid.UUID
	ExternalMessageId string
	Status            string
	Replay            bool
}

func ReserveProductionMessage(ctx context.Context, db *sql.DB, orgId, appId, credId, storeId, recipientId uuid.UUID, key, body string, now time.Time) (MessageReservation, error) {
	if !productionIdempotencyKey.MatchString(key) {
		return MessageReservation{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.")
	}
	hash := sha256.Sum256([]byte(storeId.String() + "\x00" + recipientId.String() + "\x00" + body))
	requestHash := hex.EncodeToString(hash[:])
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return MessageReservation{}, err
	}
	defer tx.Rollback()
	var lockedId uuid.UUID
	if err := tx.QueryRowContext(ctx, `SELECT id FROM developer_organizations WHERE id = $1 FOR UPDATE`, orgId).Scan(&lockedId); err != nil {
		return MessageReservation{}, err
	}
	if err := requireActiveBusinessMessageAuthorization(ctx, tx, orgId, appId, credId, storeId, recipientId); err != nil {
		return MessageReservation{}, err
	}
	var existing MessageReservation
	var storedHash string
	var externalId sql.NullString
	err = tx.QueryRowContext(ctx,
		`SELECT id, request_hash, status, external_message_id FROM developer_business_messages WHERE application_id = $1 AND idempotency_key = $2`, appId, key,
	).Scan(&existing.MessageId, &storedHash, &existing.Status, &externalId)
	if err != nil && err != sql.ErrNoRows {
		return MessageReservation{}, err
	}
	if err == nil {
		if storedHash != requestHash {
			return MessageReservation{}, httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was already used for a different message.")
		}
		existing.Replay = true
		existing.ExternalMessageId = externalId.String
		if err := tx.Commit(); err != nil {
			return MessageReservation{}, err
		}
		return existing, nil
	}
	requestId, err := reserveProductionRequestTx(ctx, tx, orgId, appId, credId, http.MethodPost, "/api/v1/business/messages")
	if err != nil {
		return MessageReservation{}, err
	}
	messageId := uuid.New()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO developer_business_messages (id, organization_id, application_id, credential_id, store_id, recipient_account_id, body_text, status, idempotency_key, request_hash, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'accepted', $8, $9, $10, $10)`,
		messageId, orgId, appId, credId, storeId, recipientId, body, key, requestHash, now,
	); err != nil {
		return MessageReservation{}, err
	}
	if err := tx.Commit(); err != nil {
		return MessageReservation{}, err
	}
	return MessageReservation{MessageId: messageId, RequestId: requestId, Status: "accepted"}, nil
}

func requireActiveBusinessMessageAuthorization(ctx context.Context, tx *sql.Tx, orgId, appId, credId, storeId, recipientId uuid.UUID) error {
	var authorized int
	err := tx.QueryRowContext(ctx, `
		SELECT 1
		FROM developer_applications app
		JOIN developer_production_credentials credential
		  ON credential.application_id = app.id AND credential.organization_id = app.organization_id
		JOIN developer_business_authorizations store_grant
		  ON store_grant.application_id = app.id AND store_grant.organization_id = app.organization_id
		JOIN developer_business_consents recipient_consent
		  ON recipient_consent.application_id = app.id AND recipient_consent.organization_id = app.organization_id
		 AND recipient_consent.store_id = store_grant.store_id
		JOIN accounts recipient ON recipient.id = recipient_consent.recipient_account_id
		WHERE app.id = $1 AND app.organization_id = $2 AND app.api_product = 'business_messaging' AND app.status = 'approved'
		  AND credential.id = $3 AND credential.status = 'active' AND credential.scopes @> '["messages:send"]'::jsonb
		  AND store_grant.store_id = $4 AND store_grant.status = 'active' AND store_grant.scopes @> '["messages:send"]'::jsonb
		  AND recipient_consent.recipient_account_id = $5 AND recipient_consent.status = 'active'
		  AND recipient_consent.scopes @> '["messages:send"]'::jsonb AND recipient.status = 'active'
		FOR SHARE OF app, credential, store_grant, recipient_consent, recipient`,
		appId, orgId, credId, storeId, recipientId).Scan(&authorized)
	if errors.Is(err, sql.ErrNoRows) {
		return httpserver.NewApiError(http.StatusForbidden, "BUSINESS_MESSAGING_AUTHORIZATION_REVOKED", "The application, store grant, credential, recipient account, or customer consent no longer authorizes this message.")
	}
	return err
}
