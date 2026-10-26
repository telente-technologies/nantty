package updatestoresettings

import (
	"context"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/modules/storeSettings/dtos"
	"nantty/modules/catalog/src/modules/storeSettings/services"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.StoreSettingsView, error) {
	request := command.Request
	if err := handler.requireKnownTaxCategories(ctx, command, request); err != nil {
		return dtos.StoreSettingsView{}, err
	}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := tx.Store.Get(ctx, command.Store.StoreId)
		if err != nil {
			return err
		}
		update := tx.Store.UpdateOneID(current.ID)
		changed := []string{}
		if request.Name != nil {
			update.SetName(strings.TrimSpace(*request.Name))
			changed = append(changed, "name")
		}
		if request.Description != nil {
			update.SetDescription(*request.Description)
			changed = append(changed, "description")
		}
		if request.Phone != nil {
			update.SetContactPhone(strings.TrimSpace(*request.Phone))
			changed = append(changed, "phone")
		}
		if request.Email != nil {
			update.SetContactEmail(strings.ToLower(strings.TrimSpace(*request.Email)))
			changed = append(changed, "email")
		}
		if request.Address != nil {
			update.SetContactAddress(strings.TrimSpace(*request.Address))
			changed = append(changed, "address")
		}
		if request.Taxes != nil {
			update.SetTaxRates(*request.Taxes)
			changed = append(changed, "taxes")
		}
		if request.PricesIncludeTax != nil {
			update.SetPricesIncludeTax(*request.PricesIncludeTax)
			changed = append(changed, "pricesIncludeTax")
		}
		if request.Policies != nil {
			update.SetPolicies(*request.Policies)
			changed = append(changed, "policies")
		}
		if request.Notifications != nil {
			merged := services.NotificationPreferencesWithDefaults(current.NotificationPreferences)
			for key, value := range *request.Notifications {
				merged[key] = value
			}
			update.SetNotificationPreferences(merged)
			changed = append(changed, "notifications")
		}
		if len(changed) == 0 {
			return nil
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		sort.Strings(changed)
		summary := "Updated store settings: " + strings.Join(changed, ", ")
		if err := catalogservices.RecordStoreAuditInTransaction(ctx, tx, catalogservices.AuditRecordFor(command.Store, command.Actor, "settings.updated", "store", current.ID.String(), summary)); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", current.ID.String(), handler.Container.Now(), map[string]any{"storeId": current.ID, "changed": changed})
	})
	if err != nil {
		return dtos.StoreSettingsView{}, err
	}
	row, err := handler.Container.Client.Store.Get(ctx, command.Store.StoreId)
	if err != nil {
		return dtos.StoreSettingsView{}, err
	}
	return services.PresentStoreSettings(ctx, row)
}

func (handler Handler) requireKnownTaxCategories(ctx context.Context, command Command, request dtos.UpdateStoreSettingsRequest) error {
	if request.Taxes == nil {
		return nil
	}
	for index, tax := range *request.Taxes {
		identifiers := services.ParseIdentifierList(tax.AppliesToCategoryIds)
		if len(identifiers) == 0 {
			continue
		}
		known, err := handler.Container.Client.Category.Query().Where(category.IDIn(identifiers...), category.Or(category.StoreIDIsNil(), category.StoreID(command.Store.StoreId))).Count(ctx)
		if err != nil {
			return err
		}
		if known != len(uniqueIdentifiers(identifiers)) {
			var issues utils.Issues
			issues.Add("taxes."+strconv.Itoa(index)+".appliesToCategoryIds", "must list categories of this store")
			return issues.AsError()
		}
	}
	return nil
}

func uniqueIdentifiers(identifiers []uuid.UUID) map[uuid.UUID]bool {
	unique := map[uuid.UUID]bool{}
	for _, identifier := range identifiers {
		unique[identifier] = true
	}
	return unique
}
