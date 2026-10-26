package exportproductscsv

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/productvariant"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

var header = []string{"product_name", "description", "category", "option1_name", "option1_value", "option2_name", "option2_value", "sku", "barcode", "price",
	"compare_at_price", "cost_price", "low_stock_threshold", "opening_stock", "taxable", "published_online"}

func NeutraliseCsvFormula(cell string) string {
	if cell != "" && strings.ContainsRune("=+-@", rune(cell[0])) {
		return "'" + cell
	}
	return cell
}

func MajorUnits(amountMinor int64, currency string) string {
	exponent := money.MinorUnitExponentForCurrency(money.CurrencyCode(currency))
	return fmt.Sprintf("%.*f", exponent, float64(amountMinor)/math.Pow10(exponent))
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]byte, error) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	_ = writer.Write(header)
	categories, err := handler.categoryNames(ctx, query.StoreId)
	if err != nil {
		return nil, err
	}
	var after *uuid.UUID
	for {
		request := handler.Container.Client.Product.Query().Where(product.StoreID(query.StoreId)).Order(ent.Asc(product.FieldID)).Limit(200)
		if after != nil {
			request = request.Where(product.IDGT(*after))
		}
		products, err := request.All(ctx)
		if err != nil {
			return nil, err
		}
		if len(products) == 0 {
			break
		}
		if err := handler.writeProducts(ctx, writer, query, products, categories); err != nil {
			return nil, err
		}
		after = &products[len(products)-1].ID
	}
	writer.Flush()
	return buffer.Bytes(), writer.Error()
}

func (handler Handler) writeProducts(ctx context.Context, writer *csv.Writer, query Query, products []*ent.Product, categories map[uuid.UUID]string) error {
	ids := make([]uuid.UUID, 0, len(products))
	byId := map[uuid.UUID]*ent.Product{}
	for _, row := range products {
		ids = append(ids, row.ID)
		byId[row.ID] = row
	}
	variants, err := handler.Container.Client.ProductVariant.Query().Where(productvariant.ProductIDIn(ids...)).Order(ent.Asc(productvariant.FieldProductID, productvariant.FieldPosition)).All(ctx)
	if err != nil {
		return err
	}
	variantIds := make([]uuid.UUID, 0, len(variants))
	for _, variant := range variants {
		variantIds = append(variantIds, variant.ID)
	}
	stock := map[uuid.UUID][]commerceports.VariantStockLevel{}
	if inventory, portError := commerceports.Default.InventoryStock(); portError == nil {
		if stock, err = inventory.StockLevelsForVariants(ctx, query.StoreId, variantIds); err != nil {
			return err
		}
	}
	for _, variant := range variants {
		parent := byId[variant.ProductID]
		_ = writer.Write(variantRow(parent, variant, categories, stock[variant.ID], query))
	}
	return nil
}

func variantRow(parent *ent.Product, variant *ent.ProductVariant, categories map[uuid.UUID]string, levels []commerceports.VariantStockLevel, query Query) []string {
	row := make([]string, len(header))
	row[0], row[1] = NeutraliseCsvFormula(parent.Name), NeutraliseCsvFormula(parent.Description)
	if parent.CategoryID != nil {
		row[2] = NeutraliseCsvFormula(categories[*parent.CategoryID])
	}
	for index, option := range parent.Options {
		if index < 2 {
			row[3+index*2], row[4+index*2] = NeutraliseCsvFormula(option.Name), NeutraliseCsvFormula(variant.OptionValues[option.Name])
		}
	}
	row[7] = NeutraliseCsvFormula(variant.Sku)
	if variant.Barcode != nil {
		row[8] = *variant.Barcode
	}
	row[9] = MajorUnits(variant.PriceMinor, parent.Currency)
	if variant.CompareAtPriceMinor != nil {
		row[10] = MajorUnits(*variant.CompareAtPriceMinor, parent.Currency)
	}
	if variant.CostPriceMinor != nil {
		row[11] = MajorUnits(*variant.CostPriceMinor, parent.Currency)
	}
	row[12] = strconv.Itoa(variant.LowStockThreshold)
	onHand := 0
	for _, level := range levels {
		if query.LocationId == nil || level.LocationId == *query.LocationId {
			onHand += level.OnHand
		}
	}
	row[13], row[14], row[15] = strconv.Itoa(onHand), strconv.FormatBool(parent.Taxable), strconv.FormatBool(parent.PublishedOnline)
	return row
}

func (handler Handler) categoryNames(ctx context.Context, storeId uuid.UUID) (map[uuid.UUID]string, error) {
	rows, err := handler.Container.Client.Category.Query().All(ctx)
	if err != nil {
		return nil, err
	}
	names := map[uuid.UUID]string{}
	for _, row := range rows {
		if row.StoreID == nil || *row.StoreID == storeId {
			names[row.ID] = row.Name
		}
	}
	return names, nil
}
