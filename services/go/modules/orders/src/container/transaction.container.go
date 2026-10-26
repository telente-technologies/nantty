package container

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/idempotentrequest"
	"nantty/platform/httpserver"
)

var ErrIdempotencyKeyReused = httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different request.")

func isRetryableConflict(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && (postgresError.Code == "40001" || postgresError.Code == "40P01")
}

func (container *Container) RunInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	var lastError error
	for attempt := 1; attempt <= 5; attempt++ {
		lastError = container.runInTransactionOnce(ctx, work)
		if lastError == nil || !isRetryableConflict(lastError) {
			return lastError
		}
		select {
		case <-ctx.Done():
			return errors.Join(lastError, ctx.Err())
		case <-time.After(time.Duration(attempt*attempt) * 5 * time.Millisecond):
		}
	}
	return lastError
}

func (container *Container) runInTransactionOnce(ctx context.Context, work func(tx *ent.Tx) error) error {
	tx, err := container.Client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	if err := work(tx); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

func FingerprintOfRequest(parts ...any) string {
	encoded, _ := json.Marshal(parts)
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

func RunIdempotently[Result any](ctx context.Context, container *Container, scope, key, requestHash string, execute func(tx *ent.Tx) (Result, error)) (Result, error) {
	var result Result
	err := container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		insertError := tx.IdempotentRequest.Create().SetScope(scope).SetKey(key).SetRequestHash(requestHash).
			OnConflictColumns(idempotentrequest.FieldScope, idempotentrequest.FieldKey).DoNothing().Exec(ctx)
		if insertError != nil && !errors.Is(insertError, sql.ErrNoRows) {
			return insertError
		}
		record, err := tx.IdempotentRequest.Query().Where(idempotentrequest.Scope(scope), idempotentrequest.Key(key)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if record.RequestHash != requestHash {
			return ErrIdempotencyKeyReused
		}
		if record.ResponseBody != nil && len(*record.ResponseBody) > 0 {
			return json.Unmarshal(*record.ResponseBody, &result)
		}
		result, err = execute(tx)
		if err != nil {
			return err
		}
		body, err := json.Marshal(result)
		if err != nil {
			return err
		}
		return record.Update().SetResponseBody(body).Exec(ctx)
	})
	return result, err
}
