package listproducts

import (
	"context"
	"fmt"
	"strings"
	"time"

	"entgo.io/ent/dialect/sql"
	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/predicate"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/productvariant"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

const (
	collectionSalesOfTheDay = "sales_of_the_day"
	collectionFeaturedBrands = "featured_brands"
	collectionNewArrivals = "new_arrivals"
	newArrivalsWindow = 7 * 24 * time.Hour
)

var supportedCollections = []string{collectionSalesOfTheDay, collectionFeaturedBrands, collectionNewArrivals}

func PublicListingConditions() []predicate.Product {
	return []predicate.Product{product.Status(enums.ProductActive), product.PublishedOnline(true), product.Visibility(enums.VisibilityPublic),
		product.ModerationVisibilityIn(enums.ModerationVisible, enums.ModerationRestricted), services.ListedStoreCondition()}
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.ProductSummaryView], error) {
	empty := httpserver.CursorPage[types.ProductSummaryView]{}
	conditions, err := handler.conditions(ctx, query)
	if err != nil {
		return empty, err
	}
	sort := sortFor(query)
	after, err := sort.after(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, after)
	}
	rows, err := handler.Container.Client.Product.Query().Where(conditions...).Order(sort.order()...).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	visible := rows
	nextCursor := ""
	if len(rows) > query.Limit {
		visible = rows[:query.Limit]
		nextCursor = sort.cursorOf(visible[len(visible)-1])
	}
	views, err := services.LoadProductSummaries(ctx, handler.Container, visible, query.Viewer)
	if err != nil {
		return empty, err
	}
	return httpserver.NewCursorPage(views, nextCursor), nil
}

func (handler Handler) conditions(ctx context.Context, query Query) ([]predicate.Product, error) {
	conditions := services.WithRegionCondition(PublicListingConditions(), services.ViewerCountry(ctx, handler.Container, query.Viewer), query.Viewer)
	if query.Collection != "" {
		condition, err := collectionCondition(query.Collection, handler.Container.Now())
		if err != nil {
			return nil, err
		}
		conditions = append(conditions, condition)
	}
	if query.CategoryId != nil {
		conditions = append(conditions, product.CategoryID(*query.CategoryId))
	}
	if query.CategorySlug != "" {
		matched, err := handler.Container.Client.Category.Query().Where(category.StoreIDIsNil(), category.Slug(query.CategorySlug)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "categorySlug", Message: "is not a known category"}})
		}
		if err != nil {
			return nil, err
		}
		children, err := handler.Container.Client.Category.Query().Where(category.ParentID(matched.ID)).IDs(ctx)
		if err != nil {
			return nil, err
		}
		conditions = append(conditions, product.CategoryIDIn(append(children, matched.ID)...))
	}
	if query.StoreId != nil {
		conditions = append(conditions, product.StoreID(*query.StoreId))
	}
	if query.BrandId != nil {
		conditions = append(conditions, product.BrandID(*query.BrandId))
	}
	if query.Text != "" {
		conditions = append(conditions, product.NameContainsFold(query.Text))
	}
	if query.Currency != "" {
		conditions = append(conditions, product.Currency(query.Currency))
	}
	if query.MinPrice != nil {
		conditions = append(conditions, product.MinPriceMinorGTE(*query.MinPrice))
	}
	if query.MaxPrice != nil {
		conditions = append(conditions, product.MinPriceMinorLTE(*query.MaxPrice))
	}
	return conditions, nil
}

func collectionCondition(collection string, now time.Time) (predicate.Product, error) {
	switch collection {
	case collectionSalesOfTheDay:
		// Sale status is represented on product variants by a compare-at price
		// greater than the current price (the same relationship used by the
		// seller product pricing model).
		return predicate.Product(func(selector *sql.Selector) {
			selector.Where(sql.P(func(builder *sql.Builder) {
				builder.WriteString("EXISTS (SELECT 1 FROM ").WriteString(productvariant.Table)
				builder.WriteString(" AS collection_variant WHERE collection_variant.").WriteString(productvariant.FieldProductID)
				builder.WriteString(" = ").WriteString(selector.C(product.FieldID))
				builder.WriteString(" AND collection_variant.").WriteString(productvariant.FieldCompareAtPriceMinor)
				builder.WriteString(" IS NOT NULL AND collection_variant.").WriteString(productvariant.FieldCompareAtPriceMinor)
				builder.WriteString(" > collection_variant.").WriteString(productvariant.FieldPriceMinor).WriteString(")")
			}))
		}), nil
	case collectionFeaturedBrands:
		// The existing collection fixture defines featured-brand products as
		// products rated at least 4.6 from verified stores. Compare the average
		// exactly as 23/5 to avoid floating-point rounding in SQL.
		return predicate.Product(func(selector *sql.Selector) {
			selector.Where(sql.P(func(builder *sql.Builder) {
				builder.WriteString("EXISTS (SELECT 1 FROM stores collection_store WHERE collection_store.id = ")
				builder.WriteString(selector.C(product.FieldStoreID))
				builder.WriteString(" AND collection_store.verified = TRUE)")
			}))
			selector.Where(sql.P(func(builder *sql.Builder) {
				builder.WriteString(selector.C(product.FieldRatingCount)).WriteString(" > 0 AND CAST(")
				builder.WriteString(selector.C(product.FieldRatingSum)).WriteString(" AS NUMERIC) * 5 >= CAST(")
				builder.WriteString(selector.C(product.FieldRatingCount)).WriteString(" AS NUMERIC) * 23")
			}))
		}), nil
	case collectionNewArrivals:
		return product.PublishedAtGTE(now.UTC().Add(-newArrivalsWindow)), nil
	default:
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{
			Path: "collection", Message: fmt.Sprintf("must be one of %s", strings.Join(supportedCollections, ", ")),
		}})
	}
}
