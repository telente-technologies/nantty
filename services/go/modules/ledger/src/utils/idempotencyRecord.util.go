package utils

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SqlIdempotencyRecordStore struct {
	Schema string
}

func (store SqlIdempotencyRecordStore) table() string {
	return pgx.Identifier{store.Schema, "idempotent_requests"}.Sanitize()
}

func (store SqlIdempotencyRecordStore) InsertRecordOrLoadExisting(ctx context.Context, transaction *sql.Tx, scope, key, requestHash string) (*StoredIdempotentResponse, error) {
	identifier, err := uuid.NewV7()
	if err != nil {
		return nil, err
	}
	result, err := transaction.ExecContext(ctx,
		"INSERT INTO "+store.table()+" (id, created_at, scope, key, request_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (scope, key) DO NOTHING",
		identifier, time.Now().UTC(), scope, key, requestHash)
	if err != nil {
		return nil, err
	}
	if inserted, _ := result.RowsAffected(); inserted == 1 {
		return nil, nil
	}
	var existing StoredIdempotentResponse
	var body []byte
	err = transaction.QueryRowContext(ctx, "SELECT request_hash, response_body FROM "+store.table()+" WHERE scope = $1 AND key = $2", scope, key).Scan(&existing.RequestHash, &body)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("idempotency record vanished while loading")
	}
	if err != nil {
		return nil, err
	}
	existing.ResponseBody = body
	existing.Completed = body != nil
	return &existing, nil
}

func (store SqlIdempotencyRecordStore) SaveCompletedResponse(ctx context.Context, transaction *sql.Tx, scope, key string, responseBody []byte) error {
	_, err := transaction.ExecContext(ctx, "UPDATE "+store.table()+" SET response_body = $1 WHERE scope = $2 AND key = $3", responseBody, scope, key)
	return err
}
