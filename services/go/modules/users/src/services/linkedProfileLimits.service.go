package services

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/linkedprofile"
	"nantty/modules/users/src/generated/ent/profilesignal"
)

const (
	PremiumBusinessProfileLimit  = 5
	StandardBusinessProfileLimit = 2
)

func AccountHasPremium(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time) (bool, error) {
	return client.ProfileSignal.Query().Where(profilesignal.AccountID(accountId), profilesignal.PremiumUntilGT(now)).Exist(ctx)
}

func OwnsStore(row *ent.LinkedProfile) bool {
	return row.Kind == linkedprofile.KindStore || row.StoreID != nil
}

func StandardSlotsOf(rows []*ent.LinkedProfile) map[uuid.UUID]bool {
	fits, slotTaken, brandTaken := map[uuid.UUID]bool{}, false, false
	for _, row := range rows {
		if row.Status != linkedprofile.StatusActive {
			continue
		}
		switch {
		case row.Kind == linkedprofile.KindBrand && !brandTaken:
			fits[row.ProfileID], brandTaken = true, true
		case IsStoreOrBusiness(row.Kind) && !slotTaken:
			fits[row.ProfileID], slotTaken = true, true
		}
	}
	return fits
}

func claimWithPremium(ctx context.Context, tx *ent.Tx, active []*ent.LinkedProfile, claim LinkedClaim) (*ent.LinkedProfile, error) {
	for _, row := range active {
		if claim.Kind == linkedprofile.KindStore && row.Kind == linkedprofile.KindStore {
			rebound, err := rebindReservedStore(ctx, tx, row, claim)
			if errors.Is(err, usersErrors.ErrProfileLimitStoreOrBusiness) {
				return nil, usersErrors.ErrStoreLimitOne
			}
			return rebound, err
		}
		if claim.Kind == linkedprofile.KindStore && OwnsStore(row) {
			return nil, usersErrors.ErrStoreLimitOne
		}
		if row.ProfileID == claim.ProfileId {
			return nil, usersErrors.ErrProfileLimitStoreOrBusiness
		}
	}
	if len(active) >= PremiumBusinessProfileLimit {
		return nil, usersErrors.ErrBusinessProfileLimitPremium
	}
	created, err := tx.LinkedProfile.Create().SetAccountID(claim.AccountId).SetKind(claim.Kind).SetProfileID(claim.ProfileId).SetNillableStoreID(claim.StoreId).Save(ctx)
	if ent.IsConstraintError(err) {
		return nil, usersErrors.ErrStoreLimitOne
	}
	return created, err
}
