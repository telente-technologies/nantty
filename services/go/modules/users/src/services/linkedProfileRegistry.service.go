package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/linkedprofile"
	"zudomart/modules/users/src/generated/ent/profile"
)

type LinkedClaim struct {
	AccountId uuid.UUID
	Kind      linkedprofile.Kind
	ProfileId uuid.UUID
	StoreId   *uuid.UUID
}

func LockLinkedProfilesOfAccount(ctx context.Context, tx *ent.Tx, accountId uuid.UUID) error {
	_, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 7))", "linked-profiles:"+accountId.String())
	return err
}

func LimitErrorFor(kind linkedprofile.Kind) error {
	if kind == linkedprofile.KindBrand {
		return usersErrors.ErrProfileLimitOneBrand
	}
	return usersErrors.ErrProfileLimitStoreOrBusiness
}

func IsStoreOrBusiness(kind linkedprofile.Kind) bool {
	return kind == linkedprofile.KindStore || kind == linkedprofile.KindBusiness
}

func ClaimLinkedProfile(ctx context.Context, tx *ent.Tx, claim LinkedClaim) (*ent.LinkedProfile, error) {
	if err := LockLinkedProfilesOfAccount(ctx, tx, claim.AccountId); err != nil {
		return nil, err
	}
	same, err := tx.LinkedProfile.Query().Where(linkedprofile.KindEQ(claim.Kind), linkedprofile.ProfileID(claim.ProfileId)).Only(ctx)
	if err == nil {
		return attachToExisting(ctx, same, claim)
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	active, err := tx.LinkedProfile.Query().Where(linkedprofile.AccountID(claim.AccountId), linkedprofile.StatusEQ(linkedprofile.StatusActive)).All(ctx)
	if err != nil {
		return nil, err
	}
	premium, err := AccountHasPremium(ctx, tx.Client(), claim.AccountId, time.Now())
	if err != nil {
		return nil, err
	}
	if premium {
		return claimWithPremium(ctx, tx, active, claim)
	}
	for _, row := range active {
		if claim.Kind == linkedprofile.KindBrand && row.Kind == linkedprofile.KindBrand {
			return nil, usersErrors.ErrProfileLimitOneBrand
		}
		if IsStoreOrBusiness(claim.Kind) && IsStoreOrBusiness(row.Kind) {
			return rebindReservedStore(ctx, tx, row, claim)
		}
	}
	created, err := tx.LinkedProfile.Create().SetAccountID(claim.AccountId).SetKind(claim.Kind).SetProfileID(claim.ProfileId).SetNillableStoreID(claim.StoreId).Save(ctx)
	if ent.IsConstraintError(err) {
		return nil, LimitErrorFor(claim.Kind)
	}
	return created, err
}

func attachToExisting(ctx context.Context, row *ent.LinkedProfile, claim LinkedClaim) (*ent.LinkedProfile, error) {
	if row.AccountID != claim.AccountId {
		return nil, LimitErrorFor(claim.Kind)
	}
	if row.Status != linkedprofile.StatusActive {
		return nil, usersErrors.ErrProfileOnHold
	}
	if claim.StoreId == nil || (row.StoreID != nil && *row.StoreID == *claim.StoreId) {
		return row, nil
	}
	if row.StoreID != nil {
		return nil, usersErrors.ErrProfileLimitStoreOrBusiness
	}
	return row.Update().SetStoreID(*claim.StoreId).Save(ctx)
}

func rebindReservedStore(ctx context.Context, tx *ent.Tx, row *ent.LinkedProfile, claim LinkedClaim) (*ent.LinkedProfile, error) {
	if claim.Kind != linkedprofile.KindStore || row.Kind != linkedprofile.KindStore || row.StoreID != nil {
		return nil, usersErrors.ErrProfileLimitStoreOrBusiness
	}
	backedByProfile, err := tx.Profile.Query().Where(profile.ID(row.ProfileID), profile.KindEQ(profile.KindBusiness)).Exist(ctx)
	if err != nil {
		return nil, err
	}
	if backedByProfile && row.ProfileID != claim.ProfileId {
		return nil, usersErrors.ErrProfileLimitStoreOrBusiness
	}
	return row.Update().SetProfileID(claim.ProfileId).SetNillableStoreID(claim.StoreId).Save(ctx)
}

func ReleaseLinkedProfile(ctx context.Context, tx *ent.Tx, claim LinkedClaim) error {
	if err := LockLinkedProfilesOfAccount(ctx, tx, claim.AccountId); err != nil {
		return err
	}
	row, err := tx.LinkedProfile.Query().Where(linkedprofile.AccountID(claim.AccountId), linkedprofile.KindEQ(claim.Kind), linkedprofile.ProfileID(claim.ProfileId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if claim.StoreId != nil {
		if row.StoreID != nil && *row.StoreID == *claim.StoreId {
			return row.Update().ClearStoreID().Exec(ctx)
		}
		return nil
	}
	if row.StoreID != nil {
		return nil
	}
	if row.Kind != linkedprofile.KindBrand {
		backedByProfile, err := tx.Profile.Query().Where(profile.ID(row.ProfileID)).Exist(ctx)
		if err != nil || backedByProfile {
			return err
		}
	}
	return tx.LinkedProfile.DeleteOne(row).Exec(ctx)
}

func LinkedKindForBusinessPurpose(purpose, businessType string) linkedprofile.Kind {
	if purpose == "store" {
		return linkedprofile.KindStore
	}
	if businessType == "brand" {
		return linkedprofile.KindBrand
	}
	return linkedprofile.KindBusiness
}

func LinkedProfilesOfAccount(ctx context.Context, client *ent.Client, accountId uuid.UUID) ([]*ent.LinkedProfile, error) {
	return client.LinkedProfile.Query().Where(linkedprofile.AccountID(accountId), linkedprofile.StatusNEQ(linkedprofile.StatusRetired)).Order(ent.Asc(linkedprofile.FieldCreatedAt)).All(ctx)
}
