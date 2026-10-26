package listproducts

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/predicate"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

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
