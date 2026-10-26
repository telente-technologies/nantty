package repositories

import (
	"context"
	"database/sql"

	"github.com/jackc/pgx/v5"

	ledgerutils "nantty/modules/ledger/src/utils"
)

type SocialBlocks struct {
	Database     *sql.DB
	SocialSchema string
}

func (blocks SocialBlocks) BlockedEitherWay(ctx context.Context, firstUserId, secondUserId string) (bool, error) {
	if blocks.Database == nil || blocks.SocialSchema == "" || !ledgerutils.IsUuid(firstUserId) || !ledgerutils.IsUuid(secondUserId) {
		return false, nil
	}
	query := `SELECT EXISTS (SELECT 1 FROM ` + pgx.Identifier{blocks.SocialSchema, "blocks"}.Sanitize() +
		` WHERE ("blockerId" = $1::uuid AND "blockedId" = $2::uuid) OR ("blockerId" = $2::uuid AND "blockedId" = $1::uuid))`
	var blocked bool
	err := blocks.Database.QueryRowContext(ctx, query, firstUserId, secondUserId).Scan(&blocked)
	return blocked, err
}
