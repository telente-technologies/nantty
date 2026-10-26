package utils

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"regexp"

	"nantty/modules/ledger/src/databases"
	"nantty/platform/httpserver"
)

var idempotencyKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)

var (
	ErrIdempotencyKeyRequired = httpserver.NewApiError(http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header of 8-128 letters, digits, - or _.")
	ErrIdempotencyKeyReused   = httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different request.")
	ErrIdempotencyInProgress  = httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_IN_PROGRESS", "This request is still being processed. Try again in a moment.")
)

func IsValidIdempotencyKey(key string) bool { return idempotencyKeyPattern.MatchString(key) }

func ReadRequiredIdempotencyKey(request *http.Request) (string, error) {
	key := request.Header.Get("Idempotency-Key")
	if !IsValidIdempotencyKey(key) {
		return "", ErrIdempotencyKeyRequired
	}
	return key, nil
}

func HashRequestFingerprint(parts ...any) string {
	encoded, _ := json.Marshal(parts)
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

type StoredIdempotentResponse struct {
	RequestHash  string
	ResponseBody []byte
	Completed    bool
}

type IdempotencyRecordStore interface {
	InsertRecordOrLoadExisting(ctx context.Context, transaction *sql.Tx, scope, key, requestHash string) (*StoredIdempotentResponse, error)
	SaveCompletedResponse(ctx context.Context, transaction *sql.Tx, scope, key string, responseBody []byte) error
}

type IdempotentCommand[Result any] struct {
	Scope       string
	Key         string
	RequestHash string
	Execute     func(ctx context.Context, transaction *sql.Tx) (Result, error)
}

func RunIdempotentMoneyCommand[Result any](ctx context.Context, database *sql.DB, store IdempotencyRecordStore, command IdempotentCommand[Result]) (Result, bool, error) {
	var result Result
	replayed := false
	err := databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
		replayed = false
		existing, err := store.InsertRecordOrLoadExisting(ctx, transaction, command.Scope, command.Key, command.RequestHash)
		if err != nil {
			return err
		}
		if existing != nil {
			if existing.RequestHash != command.RequestHash {
				return ErrIdempotencyKeyReused
			}
			if !existing.Completed {
				return ErrIdempotencyInProgress
			}
			replayed = true
			return json.Unmarshal(existing.ResponseBody, &result)
		}
		result, err = command.Execute(ctx, transaction)
		if err != nil {
			return err
		}
		body, err := json.Marshal(result)
		if err != nil {
			return err
		}
		return store.SaveCompletedResponse(ctx, transaction, command.Scope, command.Key, body)
	})
	return result, replayed, err
}
