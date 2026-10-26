package listproducts

import (
	"strconv"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/predicate"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

var Sorts = []string{"newest", "price_asc", "price_desc", "popular"}

type productSort struct {
	field      string
	descending bool
}

func sortFor(query Query) productSort {
	switch {
	case query.Sort == "price_asc":
		return productSort{product.FieldMinPriceMinor, false}
	case query.Sort == "price_desc":
		return productSort{product.FieldMinPriceMinor, true}
	case query.Sort == "popular" || (query.Sort == "" && query.Featured):
		return productSort{product.FieldUnitsSold, true}
	}
	return productSort{product.FieldPublishedAt, true}
}

func (sort productSort) order() []product.OrderOption {
	direction := ent.Asc
	if sort.descending {
		direction = ent.Desc
	}
	return []product.OrderOption{direction(sort.field), direction(product.FieldID)}
}

func (sort productSort) cursorOf(row *ent.Product) string {
	switch sort.field {
	case product.FieldMinPriceMinor:
		return utils.EncodeCursor(strconv.FormatInt(row.MinPriceMinor, 10), row.ID.String())
	case product.FieldUnitsSold:
		return utils.EncodeCursor(strconv.Itoa(row.UnitsSold), row.ID.String())
	}
	return utils.EncodeCursor(strconv.FormatInt(row.PublishedAt.UnixMicro(), 10), row.ID.String())
}

func (sort productSort) after(raw string) (predicate.Product, error) {
	parts, err := utils.DecodeCursor(raw, 2)
	if err != nil || parts == nil {
		return nil, err
	}
	number, numberError := strconv.ParseInt(parts[0], 10, 64)
	identifier, idError := uuid.Parse(parts[1])
	if numberError != nil || idError != nil {
		return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
	}
	var value any = number
	if sort.field == product.FieldPublishedAt {
		value = microsecondsToTime(number)
	}
	return predicate.Product(func(selector *sql.Selector) {
		column, idColumn := selector.C(sort.field), selector.C(product.FieldID)
		if sort.descending {
			selector.Where(sql.Or(sql.LT(column, value), sql.And(sql.EQ(column, value), sql.LT(idColumn, identifier))))
			return
		}
		selector.Where(sql.Or(sql.GT(column, value), sql.And(sql.EQ(column, value), sql.GT(idColumn, identifier))))
	}), nil
}
