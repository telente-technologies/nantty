package developerproduction

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrMessageDispatchNotConfirmed = errors.New("message dispatch status was not confirmed")

func ConfirmProductionMessageDispatch(ctx context.Context, db *sql.DB, messageId uuid.UUID, externalId string, now time.Time) error {
	result, err := db.ExecContext(ctx,
		`UPDATE developer_business_messages SET status = 'dispatched', external_message_id = $2, updated_at = $3
		 WHERE id = $1 AND status = 'accepted'`,
		messageId, externalId, now,
	)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows != 1 {
		return ErrMessageDispatchNotConfirmed
	}
	return nil
}
