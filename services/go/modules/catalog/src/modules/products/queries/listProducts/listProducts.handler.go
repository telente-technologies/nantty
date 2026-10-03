package listproducts

import (
	"context"
	"strconv"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/predicate"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func PublicListingConditions() []predicate.Product {
	return []predicate.Product{product.Status(enums.ProductActive), product.PublishedOnline(true), product.Visibility(enums.VisibilityPublic)}
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.ProductSummaryView], error) {
	empty := httpserver.CursorPage[types.ProductSummaryView]{}
	conditions := PublicListingConditions()
	if query.CategoryId != nil {
		conditions = append(conditions, product.CategoryID(*query.CategoryId))
	}
	if query.StoreId != nil {
		conditions = append(conditions, product.StoreID(*query.StoreId))
	}
	if query.Text != "" {
		conditions = append(conditions, product.NameContainsFold(query.Text))
	}
	after, err := cursorCondition(query.Cursor, query.Featured)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, after)
	}
	request := handler.Container.Client.Product.Query().Where(conditions...)
	if query.Featured {
		request = request.Order(ent.Desc(product.FieldUnitsSold), ent.Desc(product.FieldID))
	} else {
		request = request.Order(ent.Desc(product.FieldPublishedAt), ent.Desc(product.FieldID))
	}
	rows, err := request.Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	visible := rows
	nextCursor := ""
	if len(rows) > query.Limit {
		visible = rows[:query.Limit]
		nextCursor = cursorOf(visible[len(visible)-1], query.Featured)
	}
	views, err := services.LoadProductSummaries(ctx, handler.Container, visible, query.Viewer)
	if err != nil {
		return empty, err
	}
	return httpserver.NewCursorPage(views, nextCursor), nil
}

func cursorOf(row *ent.Product, featured bool) string {
	if featured {
		return utils.EncodeCursor(strconv.Itoa(row.UnitsSold), row.ID.String())
	}
	return utils.EncodeCursor(strconv.FormatInt(row.PublishedAt.UnixMicro(), 10), row.ID.String())
}

func cursorCondition(raw string, featured bool) (predicate.Product, error) {
	parts, err := utils.DecodeCursor(raw, 2)
	if err != nil || parts == nil {
		return nil, err
	}
	number, numberError := strconv.ParseInt(parts[0], 10, 64)
	identifier, idError := uuid.Parse(parts[1])
	if numberError != nil || idError != nil {
		return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
	}
	return predicate.Product(func(selector *sql.Selector) {
		idColumn := selector.C(product.FieldID)
		if featured {
			column := selector.C(product.FieldUnitsSold)
			selector.Where(sql.Or(sql.LT(column, number), sql.And(sql.EQ(column, number), sql.LT(idColumn, identifier))))
			return
		}
		column := selector.C(product.FieldPublishedAt)
		moment := microsecondsToTime(number)
		selector.Where(sql.Or(sql.LT(column, moment), sql.And(sql.EQ(column, moment), sql.LT(idColumn, identifier))))
	}), nil
}
