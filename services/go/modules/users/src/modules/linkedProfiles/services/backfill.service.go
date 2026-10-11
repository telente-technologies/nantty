package services

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/linkedprofile"
	"zudomart/modules/users/src/generated/ent/profile"
	usersservices "zudomart/modules/users/src/services"
)

const HeldReason = "Your account has more profiles than the rule allows. Choose which to keep."

type BackfillReport struct {
	Registered   int `json:"registered"`
	Held         int `json:"held"`
	HeldAccounts int `json:"heldAccounts"`
}

type Backfill struct {
	Container *container.Container
}

type candidate struct {
	kind      linkedprofile.Kind
	profileId uuid.UUID
	storeId   *uuid.UUID
	createdAt time.Time
}

func (backfill Backfill) Run(ctx context.Context) (BackfillReport, error) {
	byAccount, err := backfill.unregisteredCandidates(ctx)
	if err != nil {
		return BackfillReport{}, err
	}
	report := BackfillReport{}
	for accountId, candidates := range byAccount {
		registered, held, err := backfill.registerAccount(ctx, accountId, candidates)
		if err != nil {
			return report, err
		}
		report.Registered += registered
		report.Held += held
		if held > 0 {
			report.HeldAccounts++
		}
	}
	return report, nil
}

func (backfill Backfill) unregisteredCandidates(ctx context.Context) (map[uuid.UUID][]candidate, error) {
	client := backfill.Container.Client
	known, err := client.LinkedProfile.Query().Select(linkedprofile.FieldProfileID).Strings(ctx)
	if err != nil {
		return nil, err
	}
	registered := map[string]bool{}
	for _, identifier := range known {
		registered[identifier] = true
	}
	profiles, err := client.Profile.Query().Where(profile.KindEQ(profile.KindBusiness), profile.StatusEQ(profile.StatusActive)).All(ctx)
	if err != nil {
		return nil, err
	}
	byAccount := map[uuid.UUID][]candidate{}
	accounts := []uuid.UUID{}
	for _, row := range profiles {
		if registered[row.ID.String()] {
			continue
		}
		kind := linkedprofile.KindBusiness
		if row.ProfileType == profile.ProfileTypeBrand {
			kind = linkedprofile.KindBrand
		}
		if _, seen := byAccount[row.AccountID]; !seen {
			accounts = append(accounts, row.AccountID)
		}
		byAccount[row.AccountID] = append(byAccount[row.AccountID], candidate{kind: kind, profileId: row.ID, createdAt: row.CreatedAt})
	}
	if backfill.Container.Catalog == nil {
		return byAccount, nil
	}
	if err := backfill.attachStores(ctx, accounts, byAccount); err != nil {
		return nil, err
	}
	brands, err := backfill.Container.Catalog.FindBrands(ctx, nil, nil)
	if err != nil {
		return nil, err
	}
	for _, brand := range brands {
		if brand.OwnerAccountId != nil && !registered[brand.Id.String()] {
			byAccount[*brand.OwnerAccountId] = append(byAccount[*brand.OwnerAccountId], candidate{kind: linkedprofile.KindBrand, profileId: brand.Id, createdAt: brand.CreatedAt})
		}
	}
	return byAccount, nil
}

func (backfill Backfill) attachStores(ctx context.Context, accounts []uuid.UUID, byAccount map[uuid.UUID][]candidate) error {
	stores, err := backfill.Container.Catalog.FindStoresOfAccounts(ctx, accounts)
	if err != nil {
		return err
	}
	for _, store := range stores {
		if store.Channel != "store" || store.Status == "closed" {
			continue
		}
		for index, entry := range byAccount[store.OwnerAccountId] {
			if entry.profileId == store.BusinessProfileId {
				storeId := store.Id
				byAccount[store.OwnerAccountId][index].kind, byAccount[store.OwnerAccountId][index].storeId = linkedprofile.KindStore, &storeId
			}
		}
	}
	return nil
}

func (backfill Backfill) registerAccount(ctx context.Context, accountId uuid.UUID, candidates []candidate) (int, int, error) {
	sort.SliceStable(candidates, func(left, right int) bool {
		leftStore, rightStore := candidates[left].kind == linkedprofile.KindStore, candidates[right].kind == linkedprofile.KindStore
		if leftStore != rightStore {
			return leftStore
		}
		return candidates[left].createdAt.Before(candidates[right].createdAt)
	})
	held := 0
	err := backfill.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := usersservices.LockLinkedProfilesOfAccount(ctx, tx, accountId); err != nil {
			return err
		}
		active, err := tx.LinkedProfile.Query().Where(linkedprofile.AccountID(accountId), linkedprofile.StatusEQ(linkedprofile.StatusActive)).All(ctx)
		if err != nil {
			return err
		}
		slotTaken, brandTaken := false, false
		for _, row := range active {
			slotTaken = slotTaken || usersservices.IsStoreOrBusiness(row.Kind)
			brandTaken = brandTaken || row.Kind == linkedprofile.KindBrand
		}
		for _, entry := range candidates {
			taken := (usersservices.IsStoreOrBusiness(entry.kind) && slotTaken) || (entry.kind == linkedprofile.KindBrand && brandTaken)
			builder := tx.LinkedProfile.Create().SetAccountID(accountId).SetKind(entry.kind).SetProfileID(entry.profileId).SetNillableStoreID(entry.storeId)
			if taken {
				held++
				builder.SetStatus(linkedprofile.StatusHeld).SetHoldReason(HeldReason)
			}
			if err := builder.Exec(ctx); err != nil {
				return err
			}
			if taken {
				if _, err := tx.Profile.Update().Where(profile.ID(entry.profileId)).SetPublishingHeld(true).Save(ctx); err != nil {
					return err
				}
			}
			slotTaken = slotTaken || usersservices.IsStoreOrBusiness(entry.kind)
			brandTaken = brandTaken || entry.kind == linkedprofile.KindBrand
		}
		return nil
	})
	return len(candidates), held, err
}
