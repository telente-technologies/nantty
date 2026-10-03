package listsellerproducts

import (
	"context"
	"strconv"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/predicate"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type sortSpec struct {
	field      string
	descending bool
}

var sortSpecs = map[string]sortSpec{
	"updated": {product.FieldUpdatedAt, true}, "updated_asc": {product.FieldUpdatedAt, false},
	"name": {product.FieldName, false}, "name_desc": {product.FieldName, true},
	"price_asc": {product.FieldMinPriceMinor, false}, "price_desc": {product.FieldMinPriceMinor, true},
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.SellerProductView], error) {
	empty := httpserver.CursorPage[types.SellerProductView]{}
	spec, known := sortSpecs[query.Sort]
	if !known {
		spec = sortSpecs["updated"]
	}
	conditions, err := handler.conditions(ctx, query, spec)
	if err != nil {
		return empty, err
	}
	order := ent.Asc
	if spec.descending {
		order = ent.Desc
	}
	rows, err := handler.Container.Client.Product.Query().Where(conditions...).Order(order(spec.field), order(product.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	visible := rows
	if len(visible) > query.Limit {
		visible = visible[:query.Limit]
	}
	views, err := services.LoadSellerProductViews(ctx, handler.Container, query.StoreId, visible)
	if err != nil {
		return empty, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		nextCursor = cursorOf(visible[len(visible)-1], spec.field)
	}
	return httpserver.NewCursorPage(views, nextCursor), nil
}

func (handler Handler) conditions(ctx context.Context, query Query, spec sortSpec) ([]predicate.Product, error) {
	conditions := []predicate.Product{product.StoreID(query.StoreId)}
	switch query.Status {
	case "", "default":
		conditions = append(conditions, product.StatusIn(enums.ProductActive, enums.ProductDraft))
	case "scheduled":
		conditions = append(conditions, product.Status(enums.ProductDraft), product.PublishAtNotNil())
	case "draft":
		conditions = append(conditions, product.Status(enums.ProductDraft), product.PublishAtIsNil())
	case "all":
	default:
		conditions = append(conditions, product.Status(query.Status))
	}
	if query.Online != "" {
		conditions = append(conditions, product.PublishedOnline(query.Online == "true"))
	}
	if query.Visibility != "" {
		conditions = append(conditions, product.Visibility(query.Visibility))
	}
	if query.CategoryId != nil {
		conditions = append(conditions, product.CategoryID(*query.CategoryId))
	}
	if query.SupplierId != nil {
		conditions = append(conditions, product.SupplierID(*query.SupplierId))
	}
	if query.VariantId != nil {
		owner, err := handler.Container.Client.ProductVariant.Query().Where(productvariant.ID(*query.VariantId), productvariant.StoreID(query.StoreId)).Only(ctx)
		if err != nil {
			return nil, err
		}
		conditions = append(conditions, product.ID(owner.ProductID))
	}
	if query.Text != "" {
		matching, err := handler.Container.Client.ProductVariant.Query().Where(productvariant.StoreID(query.StoreId),
			productvariant.Or(productvariant.SkuContainsFold(query.Text), productvariant.BarcodeContains(query.Text))).Select(productvariant.FieldProductID).Strings(ctx)
		if err != nil {
			return nil, err
		}
		conditions = append(conditions, product.Or(product.NameContainsFold(query.Text), product.IDIn(parseIdentifiers(matching)...)))
	}
	cursor, err := cursorCondition(query.Cursor, spec)
	if err != nil {
		return nil, err
	}
	if cursor != nil {
		conditions = append(conditions, cursor)
	}
	return conditions, nil
}

func parseIdentifiers(values []string) []uuid.UUID {
	identifiers := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		if parsed, err := uuid.Parse(value); err == nil {
			identifiers = append(identifiers, parsed)
		}
	}
	return identifiers
}

func cursorOf(row *ent.Product, field string) string {
	switch field {
	case product.FieldName:
		return utils.EncodeCursor(row.Name, row.ID.String())
	case product.FieldMinPriceMinor:
		return utils.EncodeCursor(strconv.FormatInt(row.MinPriceMinor, 10), row.ID.String())
	}
	return utils.EncodeCursor(row.UpdatedAt.UTC().Format(time.RFC3339Nano), row.ID.String())
}

func cursorCondition(raw string, spec sortSpec) (predicate.Product, error) {
	parts, err := utils.DecodeCursor(raw, 2)
	if err != nil || parts == nil {
		return nil, err
	}
	identifier, parseError := uuid.Parse(parts[1])
	if parseError != nil {
		return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
	}
	var value any = parts[0]
	switch spec.field {
	case product.FieldMinPriceMinor:
		if value, parseError = strconv.ParseInt(parts[0], 10, 64); parseError != nil {
			return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
		}
	case product.FieldUpdatedAt:
		if value, parseError = time.Parse(time.RFC3339Nano, parts[0]); parseError != nil {
			return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
		}
	}
	return predicate.Product(func(selector *sql.Selector) {
		column, idColumn := selector.C(spec.field), selector.C(product.FieldID)
		if spec.descending {
			selector.Where(sql.Or(sql.LT(column, value), sql.And(sql.EQ(column, value), sql.LT(idColumn, identifier))))
			return
		}
		selector.Where(sql.Or(sql.GT(column, value), sql.And(sql.EQ(column, value), sql.GT(idColumn, identifier))))
	}), nil
}
