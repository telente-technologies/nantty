package services

import (
	"github.com/google/uuid"

	"nantty/modules/inventory/src/enums"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func NoteOrNil(note string) *string {
	if note == "" {
		return nil
	}
	return &note
}

func LocationView(location *ent.StockLocation) types.StoreLocationView {
	return types.StoreLocationView{
		Id: location.ID.String(), Name: location.Name, Kind: location.Kind, Address: location.Address, City: location.City,
		State: location.State, Country: location.CountryCode, Phone: location.Phone, IsDefault: location.IsDefault, Active: location.Active,
	}
}

func LevelRowView(level *ent.StockLevel, description commerceports.VariantDescription) types.InventoryLevelRowView {
	available := level.OnHand - level.Reserved
	view := types.InventoryLevelRowView{
		VariantId: level.VariantID.String(), ProductId: level.ProductID.String(), ProductName: description.ProductTitle, VariantTitle: description.VariantTitle,
		Sku: description.Sku, LocationId: level.LocationID.String(), OnHand: level.OnHand, Reserved: level.Reserved, Available: available,
		LowStockThreshold: level.LowStockLevel, ReorderPoint: level.ReorderPoint, ReorderQuantity: level.ReorderQuantity, CostPrice: description.CostPrice,
	}
	if description.ImageUrl != "" {
		view.ImageUrl = &description.ImageUrl
	}
	if description.CostPrice != nil {
		value := money.Money{AmountMinor: description.CostPrice.AmountMinor * int64(max(level.OnHand, 0)), Currency: description.CostPrice.Currency}
		view.StockValue = &value
	}
	return view
}

func SupplierView(row *ent.Supplier, productCount int) types.SupplierView {
	return types.SupplierView{
		Id: row.ID.String(), Name: row.Name, ContactName: row.ContactName, Phone: row.Phone, Email: row.Email, Address: row.Address,
		LeadTimeDays: row.LeadTimeDays, PaymentTerms: row.PaymentTerms, Notes: row.Notes, ProductCount: productCount, CreatedAt: row.CreatedAt,
	}
}

func AdjustmentView(row *ent.StockAdjustment, description commerceports.VariantDescription) types.StockAdjustmentView {
	return types.StockAdjustmentView{
		Id: row.ID.String(), VariantId: row.VariantID.String(), ProductName: description.ProductTitle, VariantTitle: description.VariantTitle,
		LocationId: row.LocationID.String(), QuantityDelta: row.QuantityDelta, Reason: row.Reason, Note: NoteOrNil(row.Note),
		CreatedBy: types.PersonView{Id: row.ActorAccountID.String(), Name: row.ActorName}, CreatedAt: row.CreatedAt,
	}
}

func MovementView(row *ent.StockMovement, description commerceports.VariantDescription) types.InventoryMovementView {
	delta := row.OnHandDelta
	if row.Kind == enums.MovementOrderReserved || row.Kind == enums.MovementOrderReleased {
		delta = -row.ReservedDelta
	}
	return types.InventoryMovementView{
		Id: row.ID.String(), Kind: row.Kind, VariantId: row.VariantID.String(), ProductId: description.ProductId.String(), ProductName: description.ProductTitle,
		VariantTitle: description.VariantTitle, Sku: description.Sku, LocationId: row.LocationID.String(), QuantityDelta: delta,
		Reference: row.Reference, Note: NoteOrNil(row.Note), ActorName: row.ActorName, CreatedAt: row.CreatedAt,
	}
}

func TransferViewFromRows(transfer *ent.StockTransfer, lines []*ent.StockTransferLine, descriptions map[uuid.UUID]commerceports.VariantDescription) types.StockTransferView {
	views := make([]types.StockTransferLineView, 0, len(lines))
	for _, line := range lines {
		description := descriptions[line.VariantID]
		views = append(views, types.StockTransferLineView{VariantId: line.VariantID.String(), ProductName: description.ProductTitle, VariantTitle: description.VariantTitle, Quantity: line.Quantity})
	}
	return types.StockTransferView{
		Id: transfer.ID.String(), Reference: transfer.Reference, FromLocationId: transfer.FromLocationID.String(), ToLocationId: transfer.ToLocationID.String(),
		Status: transfer.Status, Lines: views, Note: NoteOrNil(transfer.Note), CreatedBy: types.PersonView{Id: transfer.CreatedByAccountID.String()},
		CreatedAt: transfer.CreatedAt, ReceivedAt: transfer.ReceivedAt,
	}
}
