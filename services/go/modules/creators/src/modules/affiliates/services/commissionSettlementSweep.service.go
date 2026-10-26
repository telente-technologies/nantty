package services

import (
	"context"
	"database/sql"
	"sync"

	"github.com/google/uuid"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
)

const maximumSettlementPages = 20

// CommissionSettlementCursor remembers where the last sweep stopped, so when more commissions wait than one run may check,
// the next run carries on from there instead of rechecking the oldest ones.
type CommissionSettlementCursor struct {
	mutex sync.Mutex
	after uuid.UUID
}

func (cursor *CommissionSettlementCursor) load() uuid.UUID {
	if cursor == nil {
		return uuid.Nil
	}
	cursor.mutex.Lock()
	defer cursor.mutex.Unlock()
	return cursor.after
}

func (cursor *CommissionSettlementCursor) store(after uuid.UUID) {
	if cursor == nil {
		return
	}
	cursor.mutex.Lock()
	defer cursor.mutex.Unlock()
	cursor.after = after
}

// SettlePendingCommissions pages through every pending commission that is not backing off or out of retries, a page of `limit` at a time.
// Commissions still waiting for seller funds stay in the scan; one run checks at most maximumSettlementPages pages and wraps around.
func (affiliates Affiliates) SettlePendingCommissions(ctx context.Context, limit int) int {
	limit = max(limit, 1)
	start := affiliates.Settlement.load()
	after, before, settled := start, uuid.Nil, 0
	for page := 0; page < maximumSettlementPages; page++ {
		ids, err := affiliates.dueCommissionIds(ctx, after, before, limit)
		if err != nil {
			affiliates.Container.Resources.Logger.WarnContext(ctx, "could not list pending affiliate commissions", "error", err)
			break
		}
		for _, id := range ids {
			if affiliates.settlePendingCommission(ctx, id) {
				settled++
			}
		}
		if len(ids) == limit {
			after = ids[len(ids)-1]
			continue
		}
		if start == uuid.Nil || before != uuid.Nil {
			after = uuid.Nil
			break
		}
		after, before = uuid.Nil, start
	}
	affiliates.Settlement.store(after)
	return settled
}

func (affiliates Affiliates) dueCommissionIds(ctx context.Context, after, before uuid.UUID, limit int) ([]uuid.UUID, error) {
	now := affiliates.Container.Now().UTC()
	query := affiliates.Container.Client(affiliates.Container.Resources.Database).AffiliateCommission.Query().Where(
		affiliatecommission.StatusEQ(affiliatecommission.StatusPending),
		affiliatecommission.TransferAttemptsLT(maximumCommissionTransferAttempts),
		affiliatecommission.Or(affiliatecommission.RetryAfterIsNil(), affiliatecommission.RetryAfterLTE(now)),
	)
	if after != uuid.Nil {
		query = query.Where(affiliatecommission.IDGT(after))
	}
	if before != uuid.Nil {
		query = query.Where(affiliatecommission.IDLTE(before))
	}
	return query.Order(ent.Asc(affiliatecommission.FieldID)).Limit(limit).IDs(ctx)
}

func (affiliates Affiliates) settlePendingCommission(ctx context.Context, id uuid.UUID) bool {
	done := false
	err := affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		commission, err := client.AffiliateCommission.Query().Where(affiliatecommission.IDEQ(id)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		done, err = affiliates.settleCommissionInTransaction(ctx, transaction, client, commission)
		return err
	})
	if err != nil {
		affiliates.Container.Resources.Logger.WarnContext(ctx, "affiliate commission settlement will be retried", "commissionId", id.String(), "error", err)
		return false
	}
	return done
}
