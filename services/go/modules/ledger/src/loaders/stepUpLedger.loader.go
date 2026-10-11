package loaders

import (
	"context"
	"database/sql"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type StepUpLedger struct {
	database *sql.DB
	table    string
	calls    atomic.Int64
}

func NewStepUpLedger(database *sql.DB, ledgerSchema string) *StepUpLedger {
	return &StepUpLedger{database: database, table: pgx.Identifier{ledgerSchema, "step_up_consumptions"}.Sanitize()}
}

func (ledger *StepUpLedger) ConsumeStepUp(ctx context.Context, tokenHash, staffId, route string, expiresAt time.Time) (bool, error) {
	if ledger.calls.Add(1)%200 == 0 {
		_, _ = ledger.database.ExecContext(ctx, `DELETE FROM `+ledger.table+` WHERE expires_at < now()`)
	}
	result, err := ledger.database.ExecContext(ctx, `INSERT INTO `+ledger.table+` (id, created_at, token_hash, staff_id, route, expires_at) VALUES ($1, now(), $2, $3, $4, $5) ON CONFLICT (token_hash) DO NOTHING`,
		uuid.Must(uuid.NewV7()), tokenHash, staffId, route, expiresAt)
	if err != nil {
		return false, err
	}
	inserted, err := result.RowsAffected()
	return inserted == 1, err
}
