package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/databases/schema"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	catalogservices "zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
	"zudomart/platform/httpserver"
)

type ImportOutcome struct {
	Created  int
	Updated  int
	Failures []schema.ProductImportFailure
}

func ApplyImportPlan(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, actorId uuid.UUID, plan ImportPlan) ImportOutcome {
	outcome := ImportOutcome{Failures: append([]schema.ProductImportFailure{}, plan.Failures...)}
	for _, update := range plan.Updates {
		if err := applyVariantUpdate(ctx, deployed, store, update); err != nil {
			outcome.Failures = append(outcome.Failures, schema.ProductImportFailure{Row: update.RowNumber, Message: messageOf(err)})
			continue
		}
		outcome.Updated++
	}
	for _, group := range plan.Creates {
		if _, err := catalogservices.WriteProduct(ctx, deployed, catalogservices.ProductWrite{Store: store, ActorId: actorId, Request: group.Request}); err != nil {
			for _, row := range group.RowNumbers {
				outcome.Failures = append(outcome.Failures, schema.ProductImportFailure{Row: row, Message: messageOf(err)})
			}
			continue
		}
		outcome.Created++
	}
	return outcome
}

func applyVariantUpdate(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, update VariantUpdate) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		change := tx.ProductVariant.Update().Where(productvariant.ID(update.VariantId), productvariant.StoreID(store.StoreId)).SetPriceMinor(update.PriceMinor).SetLowStockThreshold(update.LowStock)
		if update.CostPriceMinor != nil {
			change.SetCostPriceMinor(*update.CostPriceMinor)
		}
		if _, err := change.Save(ctx); err != nil {
			return err
		}
		variants, err := tx.ProductVariant.Query().Where(productvariant.ProductID(update.ProductId)).All(ctx)
		if err != nil || len(variants) == 0 {
			return err
		}
		minimum := variants[0].PriceMinor
		for _, variant := range variants {
			minimum = min(minimum, variant.PriceMinor)
		}
		if err := tx.Product.UpdateOneID(update.ProductId).SetMinPriceMinor(minimum).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "product.updated", update.ProductId.String(), deployed.Now(), map[string]any{"productId": update.ProductId, "storeId": store.StoreId, "source": "import"})
	})
}

func messageOf(err error) string {
	if apiError, ok := err.(*httpserver.ApiError); ok {
		return apiError.Message
	}
	return "This row could not be saved."
}
