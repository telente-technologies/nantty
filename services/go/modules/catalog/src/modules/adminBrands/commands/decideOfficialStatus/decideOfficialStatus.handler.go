package decideofficialstatus

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/store"
	brandservices "nantty/modules/catalog/src/modules/adminBrands/services"
	"nantty/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (brandservices.BrandDetail, error) {
	var updated *ent.Brand
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Brand.Get(ctx, command.BrandId)
		if ent.IsNotFound(err) {
			return catalogerrors.NotFound
		}
		if err != nil {
			return err
		}
		next, allowed := brandservices.NextOfficialStatus(command.Action, row.OfficialStatus)
		if !allowed {
			return catalogerrors.InvalidOfficialStatus
		}
		before, err := badgeStores(ctx, tx, row.ID)
		if err != nil {
			return err
		}
		if err := handler.applyBadges(ctx, tx, row.ID, next); err != nil {
			return err
		}
		if updated, err = row.Update().SetOfficialStatus(next).SetOfficial(next == "OFFICIAL").Save(ctx); err != nil {
			return err
		}
		if err := handler.stampRequest(ctx, tx, row.ID, command); err != nil {
			return err
		}
		after, err := badgeStores(ctx, tx, row.ID)
		if err != nil {
			return err
		}
		if err := handler.publish(ctx, tx, row, next, append(before, after...)); err != nil {
			return err
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: brandservices.AuditActionFor(command.Action), SubjectType: brandservices.SubjectType, SubjectId: row.ID.String(), SubjectLabel: row.Name, Reason: command.Reason,
			Before: map[string]any{"officialStatus": row.OfficialStatus, "officialBadgeStores": before},
			After:  map[string]any{"officialStatus": next, "officialBadgeStores": after},
		})
	})
	if err != nil {
		return brandservices.BrandDetail{}, err
	}
	return brandservices.Detail(ctx, handler.Container, updated)
}

func badgeStores(ctx context.Context, tx *ent.Tx, brandId uuid.UUID) ([]string, error) {
	identifiers, err := tx.Store.Query().Where(store.BrandID(brandId), store.HasOfficialBadge(true)).IDs(ctx)
	stores := make([]string, 0, len(identifiers))
	for _, identifier := range identifiers {
		stores = append(stores, identifier.String())
	}
	return stores, err
}

func (handler Handler) applyBadges(ctx context.Context, tx *ent.Tx, brandId uuid.UUID, next string) error {
	if next == "OFFICIAL" {
		return tx.Store.Update().Where(store.BrandID(brandId), store.Verified(true)).SetHasOfficialBadge(true).Exec(ctx)
	}
	return tx.Store.Update().Where(store.BrandID(brandId)).SetHasOfficialBadge(false).Exec(ctx)
}

func (handler Handler) stampRequest(ctx context.Context, tx *ent.Tx, brandId uuid.UUID, command Command) error {
	request, err := brandservices.LatestRequest(ctx, tx.Client(), brandId)
	if err != nil || request == nil {
		return err
	}
	name := command.Actor.Staff.Name
	return request.Update().SetLastDecisionReason(command.Reason).SetDecidedAt(handler.Container.Now()).SetDecidedByName(name).Exec(ctx)
}

func (handler Handler) publish(ctx context.Context, tx *ent.Tx, row *ent.Brand, next string, touchedStores []string) error {
	now := handler.Container.Now()
	payload := map[string]any{"brandId": row.ID, "ownerAccountId": row.OwnerAccountID, "officialStatus": next, "previousOfficialStatus": row.OfficialStatus}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "brand.officialStatusChanged", row.ID.String(), now, payload); err != nil {
		return err
	}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "brand.updated", row.ID.String(), now, map[string]any{"brandId": row.ID}); err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, storeId := range touchedStores {
		if !seen[storeId] {
			seen[storeId] = true
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", storeId, now, map[string]any{"storeId": storeId}); err != nil {
				return err
			}
		}
	}
	return nil
}
