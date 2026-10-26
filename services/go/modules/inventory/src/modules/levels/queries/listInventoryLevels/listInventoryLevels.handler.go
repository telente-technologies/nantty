package listinventorylevels

import (
	"context"
	"strconv"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

var sortFields = map[string]string{"onHand": stocklevel.FieldOnHand, "reserved": stocklevel.FieldReserved}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.InventoryLevelRowView], error) {
	empty := httpserver.CursorPage[types.InventoryLevelRowView]{}
	conditions := []predicate.StockLevel{stocklevel.StoreID(query.StoreId), stocklevel.LocationID(query.LocationId), stocklevel.Listed(true)}
	conditions = append(conditions, stockFilter(query.Stock)...)
	if query.Text != "" {
		catalog, err := commerceports.Default.CatalogReader()
		if err != nil {
			return empty, err
		}
		matches, err := catalog.SearchStoreVariantIds(ctx, query.StoreId, query.Text, 500)
		if err != nil {
			return empty, err
		}
		conditions = append(conditions, stocklevel.VariantIDIn(matches...))
	}
	sortField, sorted := sortFields[query.Sort]
	cursorCondition, err := cursorCondition(query, sortField, sorted)
	if err != nil {
		return empty, err
	}
	if cursorCondition != nil {
		conditions = append(conditions, cursorCondition)
	}
	order := ent.Desc
	if !query.Descending && sorted {
		order = ent.Asc
	}
	levels := handler.Container.Client.StockLevel.Query().Where(conditions...)
	if sorted {
		levels = levels.Order(order(sortField), order(stocklevel.FieldID))
	} else {
		levels = levels.Order(ent.Desc(stocklevel.FieldID))
	}
	rows, err := levels.Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	descriptions, err := services.DescribeVariantsOfStore(ctx, query.StoreId, services.UniqueVariantIds(rows, func(row *ent.StockLevel) uuid.UUID { return row.VariantID }))
	if err != nil {
		return empty, err
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit,
		func(row *ent.StockLevel) types.InventoryLevelRowView {
			return services.LevelRowView(row, descriptions[row.VariantID])
		},
		func(row *ent.StockLevel) string { return cursorOf(row, sortField, sorted) }), nil
}

func stockFilter(stock string) []predicate.StockLevel {
	switch stock {
	case "low":
		return []predicate.StockLevel{predicate.StockLevel(func(selector *sql.Selector) { selector.Where(sql.ExprP("on_hand - reserved <= low_stock_level")) })}
	case "out":
		return []predicate.StockLevel{predicate.StockLevel(func(selector *sql.Selector) { selector.Where(sql.ExprP("on_hand - reserved <= 0")) })}
	case "in":
		return []predicate.StockLevel{predicate.StockLevel(func(selector *sql.Selector) { selector.Where(sql.ExprP("on_hand - reserved > low_stock_level")) })}
	}
	return nil
}

func cursorOf(row *ent.StockLevel, sortField string, sorted bool) string {
	if !sorted {
		return utils.IdentifierCursor(row.ID)
	}
	value := row.OnHand
	if sortField == stocklevel.FieldReserved {
		value = row.Reserved
	}
	return utils.EncodeCursor(strconv.Itoa(value), row.ID.String())
}

func cursorCondition(query Query, sortField string, sorted bool) (predicate.StockLevel, error) {
	if query.Cursor == "" {
		return nil, nil
	}
	if !sorted {
		identifier, err := utils.DecodeIdentifierCursor(query.Cursor)
		if err != nil || identifier == nil {
			return nil, err
		}
		return stocklevel.IDLT(*identifier), nil
	}
	parts, err := utils.DecodeCursor(query.Cursor, 2)
	if err != nil {
		return nil, err
	}
	value, valueError := strconv.Atoi(parts[0])
	identifier, idError := uuid.Parse(parts[1])
	if valueError != nil || idError != nil {
		return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
	}
	ascending := !query.Descending
	return predicate.StockLevel(func(selector *sql.Selector) {
		column := selector.C(sortField)
		idColumn := selector.C(stocklevel.FieldID)
		if ascending {
			selector.Where(sql.Or(sql.GT(column, value), sql.And(sql.EQ(column, value), sql.GT(idColumn, identifier))))
			return
		}
		selector.Where(sql.Or(sql.LT(column, value), sql.And(sql.EQ(column, value), sql.LT(idColumn, identifier))))
	}), nil
}
