package developerproduction

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
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
