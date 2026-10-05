package integrations

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type SchemaCreatorSubscriptions struct {
	Database                 *sql.DB
	Schema                   string
	TolerateUnreadableTables bool
	Logger                   *slog.Logger
}

const startedSubscriptionStatuses = `('active', 'past_due', 'cancelled', 'expired')`

func (subscriptions SchemaCreatorSubscriptions) unreadable(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && (pgError.Code == "42P01" || pgError.Code == "42501" || pgError.Code == "42703")
}

func (subscriptions SchemaCreatorSubscriptions) IsActiveSubscriber(ctx context.Context, subscriberId, creatorId uuid.UUID) (bool, error) {
	var subscribed bool
	err := subscriptions.Database.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM "`+subscriptions.Schema+`"."creator_subscriptions" WHERE subscriber_id = $1 AND creator_id = $2 AND status IN ('active', 'past_due', 'cancelled') AND current_period_end > NOW())`,
		subscriberId.String(), creatorId.String()).Scan(&subscribed)
	if err != nil && subscriptions.TolerateUnreadableTables && subscriptions.unreadable(err) {
		subscriptions.Logger.Warn("creator subscriptions are not readable by live: treating viewers as not subscribed", slog.Any("error", err))
		return false, nil
	}
	return subscribed, err
}

func (subscriptions SchemaCreatorSubscriptions) CountNewSubscribers(ctx context.Context, creatorId uuid.UUID, from, to time.Time) (int, error) {
	var count int
	err := subscriptions.Database.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM "`+subscriptions.Schema+`"."creator_subscriptions" WHERE creator_id = $1 AND created_at >= $2 AND created_at < $3 AND status IN `+startedSubscriptionStatuses,
		creatorId.String(), from, to).Scan(&count)
	if err != nil && subscriptions.unreadable(err) {
		subscriptions.Logger.Warn("creator subscription start times are not readable by live: newSubscribers shows 0", slog.Any("error", err))
		return 0, nil
	}
	return count, err
}
