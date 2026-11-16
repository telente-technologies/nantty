package integrations

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"nantty/modules/live/src/interfaces"
)

type SchemaSocialRelations struct {
	Database                 *sql.DB
	SocialSchema             string
	IdentitySchema           string
	NotificationsSchema      string
	TolerateUnreadableTables bool
	Logger                   *slog.Logger
	Subscribers              interfaces.SubscriberDirectory
}

func (relations SchemaSocialRelations) tolerate(err error) bool {
	var pgError *pgconn.PgError
	if !relations.TolerateUnreadableTables || !errors.As(err, &pgError) || (pgError.Code != "42P01" && pgError.Code != "42501") {
		return false
	}
	if relations.Logger != nil {
		relations.Logger.Warn("social tables are not readable by live: treating the relation as absent", slog.String("code", pgError.Code))
	}
	return true
}

func (relations SchemaSocialRelations) BlockedEitherWay(ctx context.Context, userId uuid.UUID, others []uuid.UUID) (map[uuid.UUID]bool, error) {
	blocked := make(map[uuid.UUID]bool, len(others))
	if len(others) == 0 {
		return blocked, nil
	}
	placeholders, arguments := placeholdersFor(2, others)
	query := `SELECT "blockerId", "blockedId" FROM "` + relations.SocialSchema + `"."blocks" WHERE ("blockerId" = $1 AND "blockedId" IN (` + placeholders + `)) OR ("blockedId" = $1 AND "blockerId" IN (` + placeholders + `))`
	rows, err := relations.Database.QueryContext(ctx, query, append([]any{userId.String()}, arguments...)...)
	if err != nil {
		if relations.tolerate(err) {
			return blocked, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var blocker, blockedUser uuid.UUID
		if err := rows.Scan(&blocker, &blockedUser); err != nil {
			return nil, err
		}
		if blocker == userId {
			blocked[blockedUser] = true
		} else {
			blocked[blocker] = true
		}
	}
	return blocked, rows.Err()
}

func (relations SchemaSocialRelations) IsFollowing(ctx context.Context, followerId, followeeId uuid.UUID) (bool, error) {
	var exists bool
	err := relations.Database.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM "`+relations.SocialSchema+`"."follows" WHERE "followerId" = $1 AND "followeeId" = $2 AND "state" = 'accepted')`,
		followerId.String(), followeeId.String()).Scan(&exists)
	if relations.tolerate(err) {
		return false, nil
	}
	return exists, err
}

func (relations SchemaSocialRelations) FollowCounts(ctx context.Context, userId uuid.UUID) (int, int, error) {
	var followers, following int
	err := relations.Database.QueryRowContext(ctx,
		`SELECT COUNT(*) FILTER (WHERE "followeeId" = $1), COUNT(*) FILTER (WHERE "followerId" = $1) FROM "`+relations.SocialSchema+`"."follows" WHERE ("followeeId" = $1 OR "followerId" = $1) AND "state" = 'accepted'`,
		userId.String()).Scan(&followers, &following)
	if relations.tolerate(err) {
		return 0, 0, nil
	}
	return followers, following, err
}

func (relations SchemaSocialRelations) IsActiveSubscriber(ctx context.Context, subscriberId, creatorId uuid.UUID) (bool, error) {
	if relations.Subscribers == nil {
		return false, nil
	}
	return relations.Subscribers.IsActiveSubscriber(ctx, subscriberId, creatorId)
}

func (relations SchemaSocialRelations) MentionPrivacyOf(ctx context.Context, userIds []uuid.UUID) (map[uuid.UUID]interfaces.MentionPrivacy, error) {
	privacy := make(map[uuid.UUID]interfaces.MentionPrivacy, len(userIds))
	if len(userIds) == 0 {
		return privacy, nil
	}
	placeholders, arguments := placeholdersFor(1, userIds)
	rows, err := relations.Database.QueryContext(ctx, `SELECT account_id, who_can_mention_me FROM "`+relations.IdentitySchema+`"."privacy_settings" WHERE account_id IN (`+placeholders+`)`, arguments...)
	if err != nil {
		if relations.tolerate(err) {
			return privacy, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var accountId uuid.UUID
		var setting string
		if err := rows.Scan(&accountId, &setting); err != nil {
			return nil, err
		}
		privacy[accountId] = interfaces.MentionPrivacy(setting)
	}
	return privacy, rows.Err()
}

func placeholdersFor(firstPosition int, identifiers []uuid.UUID) (string, []any) {
	placeholders := make([]string, len(identifiers))
	arguments := make([]any, len(identifiers))
	for index, identifier := range identifiers {
		placeholders[index] = "$" + strconv.Itoa(firstPosition+index)
		arguments[index] = identifier.String()
	}
	return strings.Join(placeholders, ","), arguments
}

func (relations SchemaSocialRelations) ListLiveAlertRecipients(ctx context.Context, hostId uuid.UUID, limit int) ([]uuid.UUID, bool, error) {
	query := `SELECT f."followerId" FROM "` + relations.SocialSchema + `"."follows" f
		WHERE f."followeeId" = $1 AND f."state" = 'accepted'
		AND NOT EXISTS (SELECT 1 FROM "` + relations.SocialSchema + `"."blocks" b WHERE (b."blockerId" = f."followerId" AND b."blockedId" = $1) OR (b."blockerId" = $1 AND b."blockedId" = f."followerId"))
		AND NOT EXISTS (SELECT 1 FROM "` + relations.NotificationsSchema + `"."notification_preferences" p WHERE p."userId" = f."followerId"::text AND p."category" = 'live' AND p."push" = false AND p."email" = false)
		ORDER BY f."followerId" LIMIT $2`
	rows, err := relations.Database.QueryContext(ctx, query, hostId.String(), limit+1)
	if err != nil {
		if relations.tolerate(err) {
			return nil, false, nil
		}
		return nil, false, err
	}
	defer rows.Close()
	var recipients []uuid.UUID
	for rows.Next() {
		var followerId uuid.UUID
		if err := rows.Scan(&followerId); err != nil {
			return nil, false, err
		}
		recipients = append(recipients, followerId)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	if len(recipients) > limit {
		return recipients[:limit], true, nil
	}
	return recipients, false, nil
}

func (relations SchemaSocialRelations) FollowedAmong(ctx context.Context, followerId uuid.UUID, candidates []uuid.UUID) (map[uuid.UUID]bool, error) {
	followed := make(map[uuid.UUID]bool, len(candidates))
	if len(candidates) == 0 {
		return followed, nil
	}
	placeholders, arguments := placeholdersFor(2, candidates)
	query := `SELECT "followeeId" FROM "` + relations.SocialSchema + `"."follows" WHERE "followerId" = $1 AND "state" = 'accepted' AND "followeeId" IN (` + placeholders + `)`
	rows, err := relations.Database.QueryContext(ctx, query, append([]any{followerId.String()}, arguments...)...)
	if err != nil {
		if relations.tolerate(err) {
			return followed, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var followeeId uuid.UUID
		if err := rows.Scan(&followeeId); err != nil {
			return nil, err
		}
		followed[followeeId] = true
	}
	return followed, rows.Err()
}

func (relations SchemaSocialRelations) ListFollowedUserIds(ctx context.Context, followerId uuid.UUID) ([]uuid.UUID, error) {
	query := `SELECT "followeeId" FROM "` + relations.SocialSchema + `"."follows" WHERE "followerId" = $1 AND "state" = 'accepted' LIMIT 2000`
	rows, err := relations.Database.QueryContext(ctx, query, followerId.String())
	if err != nil {
		if relations.tolerate(err) {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()
	var followed []uuid.UUID
	for rows.Next() {
		var followeeId uuid.UUID
		if err := rows.Scan(&followeeId); err != nil {
			return nil, err
		}
		followed = append(followed, followeeId)
	}
	return followed, rows.Err()
}
