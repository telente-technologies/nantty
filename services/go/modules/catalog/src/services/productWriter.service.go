package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/productmedia"
	"nantty/modules/catalog/src/generated/ent/productvariant"
	"nantty/modules/catalog/src/modules/sellerProducts/dtos"
	"nantty/platform/commerceports"
)

type ProductWrite struct {
	Store     commerceports.StoreAccess
	ActorId   uuid.UUID
	ProductId *uuid.UUID
	Request   dtos.ProductUpsertRequest
}

type provisionedVariant struct {
	Variant *ent.ProductVariant
	Opening []commerceports.OpeningStock
	IsNew   bool
}

func WriteProduct(ctx context.Context, deployed *container.Container, write ProductWrite) (uuid.UUID, error) {
	inventory, err := commerceports.Default.InventoryStock()
	if err != nil {
		return uuid.Nil, err
	}
	if err := checkReferencesBeforeWrite(ctx, deployed, inventory, write); err != nil {
		return uuid.Nil, err
	}
	if err := checkActiveProductCap(ctx, deployed, write); err != nil {
		return uuid.Nil, err
	}
	if write.ProductId == nil {
		owner, err := deployed.Client.Store.Get(ctx, write.Store.StoreId)
		if err != nil {
			return uuid.Nil, err
		}
		if err := AssertStoreAcceptsNewListings(ctx, deployed, owner); err != nil {
			return uuid.Nil, err
		}
	}
	var product *ent.Product
	var provisioned []provisionedVariant
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var writeError error
		product, provisioned, writeError = writeProductRows(ctx, deployed, tx, inventory, write)
		return writeError
	})
	if ent.IsConstraintError(err) {
		return uuid.Nil, mapVariantConstraint(err)
	}
	if err != nil {
		return uuid.Nil, err
	}
	listed := product.TrackInventory && product.Status != enums.ProductArchived
	for _, item := range provisioned {
		reorderPoint, reorderQuantity := item.Variant.ReorderPoint, item.Variant.ReorderQuantity
		if err := inventory.ProvisionVariantStock(ctx, commerceports.ProvisionVariantStockRequest{
			StoreId: write.Store.StoreId, ProductId: product.ID, VariantId: item.Variant.ID, LowStockLevel: item.Variant.LowStockThreshold,
			ReorderPoint: reorderPoint, ReorderQuantity: reorderQuantity, Listed: listed, Opening: item.Opening, ActorAccountId: write.ActorId,
			MovementRefToken: product.ID.String(),
		}); err != nil {
			return uuid.Nil, err
		}
	}
	return product.ID, inventory.SetProductListed(ctx, write.Store.StoreId, product.ID, listed)
}

func mapVariantConstraint(err error) error {
	if strings.Contains(err.Error(), "barcode") {
		return catalogerrors.BarcodeTaken
	}
	return catalogerrors.SkuTaken
}

func checkReferencesBeforeWrite(ctx context.Context, deployed *container.Container, inventory commerceports.InventoryStock, write ProductWrite) error {
	request := write.Request
	if request.CategoryId != nil {
		categoryId := uuid.MustParse(*request.CategoryId)
		found, err := deployed.Client.Category.Query().Where(category.ID(categoryId), category.Or(category.StoreIDIsNil(), category.StoreID(write.Store.StoreId))).Exist(ctx)
		if err != nil || !found {
			return firstError(err, catalogerrors.CategoryNotFound)
		}
	}
	if request.Brand != nil {
		if found, err := deployed.Client.Brand.Query().Where(brandIdentifier(request.Brand.BrandId)).Exist(ctx); err != nil || !found {
			return firstError(err, catalogerrors.BrandNotFound)
		}
	}
	if request.SupplierId != nil {
		supplierId := uuid.MustParse(*request.SupplierId)
		found, err := inventory.ListSuppliersForStore(ctx, write.Store.StoreId, []uuid.UUID{supplierId})
		if err != nil || len(found) == 0 {
			return firstError(err, catalogerrors.SupplierNotFound)
		}
	}
	locations := []uuid.UUID{}
	for _, variant := range request.Variants {
		for _, line := range variant.OpeningStock {
			locations = append(locations, uuid.MustParse(line.LocationId))
		}
	}
	if owned, err := inventory.StoreOwnsLocations(ctx, write.Store.StoreId, locations); err != nil || !owned {
		return firstError(err, catalogerrors.InvalidLocation)
	}
	return nil
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}

func writeProductRows(ctx context.Context, deployed *container.Container, tx *ent.Tx, inventory commerceports.InventoryStock, write ProductWrite) (*ent.Product, []provisionedVariant, error) {
	request := write.Request
	now := deployed.Now()
	status, visibility := request.Status, enums.VisibilityPublic
	if request.Visibility != nil {
		visibility = *request.Visibility
	}
	product, existing, err := upsertProductRow(ctx, deployed, tx, write, status, visibility, now)
	if err != nil {
		return nil, nil, err
	}
	if err := replaceProductMedia(ctx, deployed, tx, product.ID, request.ImageMediaIds); err != nil {
		return nil, nil, err
	}
	provisioned, err := replaceVariants(ctx, tx, inventory, write, product, existing)
	if err != nil {
		return nil, nil, err
	}
	minimum := minimumPrice(provisioned)
	product, err = tx.Product.UpdateOneID(product.ID).SetMinPriceMinor(minimum).Save(ctx)
	if err != nil {
		return nil, nil, err
	}
	eventType := "product.updated"
	if !existing {
		eventType = "product.created"
	}
	return product, provisioned, events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, product.ID.String(), now, map[string]any{
		"productId": product.ID, "storeId": product.StoreID, "status": product.Status, "visibility": product.Visibility, "categoryId": product.CategoryID,
	})
}

func minimumPrice(items []provisionedVariant) int64 {
	minimum := int64(-1)
	for _, item := range items {
		if minimum < 0 || item.Variant.PriceMinor < minimum {
			minimum = item.Variant.PriceMinor
		}
	}
	return max(minimum, 0)
}

func upsertProductRow(ctx context.Context, deployed *container.Container, tx *ent.Tx, write ProductWrite, status, visibility string, now time.Time) (*ent.Product, bool, error) {
	request := write.Request
	online := request.PublishedOnline && status == enums.ProductActive
	options := toSchemaOptions(request.Options)
	if write.ProductId == nil {
		create := tx.Product.Create().SetStoreID(write.Store.StoreId).SetName(strings.TrimSpace(request.Name)).SetDescription(request.Description).
			SetStatus(status).SetVisibility(visibility).SetPublishedOnline(online).SetTaxable(request.Taxable).SetTrackInventory(request.TrackInventory).
			SetTags(normalizeTags(request.Tags)).SetOptions(options).SetAttributes(toSchemaAttributes(request.Attributes)).
			SetVideos(toSchemaVideos(request.Videos)).SetCurrency(string(write.Store.Currency)).SetNillablePublishAt(request.PublishAt)
		applyParcelFieldsToCreate(create, request)
		applyReferences(create, request)
		if online {
			create.SetPublishedAt(now)
		}
		created, err := create.Save(ctx)
		return created, false, err
	}
	current, err := tx.Product.Get(ctx, *write.ProductId)
	if ent.IsNotFound(err) || (err == nil && current.StoreID != write.Store.StoreId) {
		return nil, false, catalogerrors.ProductNotFound
	}
	if err != nil {
		return nil, false, err
	}
	update := current.Update().SetName(strings.TrimSpace(request.Name)).SetDescription(request.Description).SetStatus(status).SetPublishedOnline(online).
		SetTaxable(request.Taxable).SetTrackInventory(request.TrackInventory).SetTags(normalizeTags(request.Tags)).SetOptions(options).
		SetNillablePublishAt(request.PublishAt)
	if request.PublishAt == nil {
		update.ClearPublishAt()
	}
	if request.Visibility != nil {
		update.SetVisibility(*request.Visibility)
	}
	if request.Attributes != nil {
		update.SetAttributes(toSchemaAttributes(request.Attributes))
	}
	if request.Videos != nil {
		update.SetVideos(toSchemaVideos(request.Videos))
	}
	applyParcelFieldsToUpdate(update, request)
	applyReferencesToUpdate(update, request)
	if online && current.PublishedAt == nil {
		update.SetPublishedAt(now)
	}
	if !online {
		update.ClearPublishedAt()
	}
	updated, err := update.Save(ctx)
	return updated, true, err
}

func replaceProductMedia(ctx context.Context, deployed *container.Container, tx *ent.Tx, productId uuid.UUID, mediaIds []string) error {
	existing, err := tx.ProductMedia.Query().Where(productmedia.ProductID(productId)).All(ctx)
	if err != nil {
		return err
	}
	urls := map[string]string{}
	for _, row := range existing {
		urls[row.MediaID] = row.URL
	}
	if _, err := tx.ProductMedia.Delete().Where(productmedia.ProductID(productId)).Exec(ctx); err != nil {
		return err
	}
	for position, mediaId := range mediaIds {
		url := urls[mediaId]
		if url == "" {
			url = strings.TrimRight(deployed.Settings.MediaPublicBaseUrl, "/") + "/m/" + mediaId + "/display.jpg"
		}
		if err := tx.ProductMedia.Create().SetProductID(productId).SetMediaID(mediaId).SetURL(url).SetPosition(position).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func replaceVariants(ctx context.Context, tx *ent.Tx, inventory commerceports.InventoryStock, write ProductWrite, product *ent.Product, existingProduct bool) ([]provisionedVariant, error) {
	current := map[uuid.UUID]*ent.ProductVariant{}
	if existingProduct {
		rows, err := tx.ProductVariant.Query().Where(productvariant.ProductID(product.ID)).ForUpdate().All(ctx)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			current[row.ID] = row
		}
	}
	kept := map[uuid.UUID]bool{}
	result := make([]provisionedVariant, 0, len(write.Request.Variants))
	for position, request := range write.Request.Variants {
		item, err := upsertVariant(ctx, tx, write, product, request, position, current)
		if err != nil {
			return nil, err
		}
		kept[item.Variant.ID] = true
		result = append(result, item)
	}
	removed := []uuid.UUID{}
	for identifier := range current {
		if !kept[identifier] {
			removed = append(removed, identifier)
		}
	}
	if len(removed) == 0 {
		return result, nil
	}
	stock, err := inventory.OnHandByVariant(ctx, write.Store.StoreId, removed)
	if err != nil {
		return nil, err
	}
	for _, quantity := range stock {
		if quantity != 0 {
			return nil, catalogerrors.VariantHasStock
		}
	}
	_, err = tx.ProductVariant.Delete().Where(productvariant.IDIn(removed...)).Exec(ctx)
	return result, err
}
