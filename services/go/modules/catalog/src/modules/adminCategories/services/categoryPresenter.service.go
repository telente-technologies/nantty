package services

import (
	"context"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/modules/adminCategories/dtos"
)

const SubjectType = "category"

func ProductCounts(ctx context.Context, deployed *container.Container, categoryIds []uuid.UUID) (map[uuid.UUID]int, error) {
	var rows []struct {
		CategoryId uuid.UUID `json:"category_id"`
		Count      int       `json:"count"`
	}
	err := deployed.Client.Product.Query().Where(product.CategoryIDIn(categoryIds...), product.StatusNEQ(enums.ProductArchived)).
		GroupBy(product.FieldCategoryID).Aggregate(func(selector *sql.Selector) string { return sql.As(sql.Count("*"), "count") }).Scan(ctx, &rows)
	counts := map[uuid.UUID]int{}
	for _, row := range rows {
		counts[row.CategoryId] = row.Count
	}
	return counts, err
}

func Present(row *ent.Category, productCount int) dtos.CatalogCategory {
	view := dtos.CatalogCategory{Id: row.ID.String(), Name: row.Name, Slug: row.Slug, IconName: row.IconName, IsActive: row.Active, SortOrder: row.SortOrder, ProductCount: productCount, UpdatedAt: row.UpdatedAt}
	if row.ParentID != nil {
		parent := row.ParentID.String()
		view.ParentId = &parent
	}
	return view
}

func PresentOne(ctx context.Context, deployed *container.Container, row *ent.Category) (dtos.CatalogCategory, error) {
	counts, err := ProductCounts(ctx, deployed, []uuid.UUID{row.ID})
	return Present(row, counts[row.ID]), err
}

func ListAll(ctx context.Context, client *ent.Client) ([]*ent.Category, error) {
	return client.Category.Query().Where(category.StoreIDIsNil()).Order(ent.Asc(category.FieldDepth), ent.Asc(category.FieldSortOrder), ent.Asc(category.FieldName)).All(ctx)
}

func PresentAll(ctx context.Context, deployed *container.Container) ([]dtos.CatalogCategory, error) {
	rows, err := ListAll(ctx, deployed.Client)
	if err != nil {
		return nil, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.ID)
	}
	counts, err := ProductCounts(ctx, deployed, identifiers)
	if err != nil {
		return nil, err
	}
	views := make([]dtos.CatalogCategory, 0, len(rows))
	for _, row := range rows {
		views = append(views, Present(row, counts[row.ID]))
	}
	return views, nil
}

func FindPlatformCategory(ctx context.Context, client *ent.Client, categoryId uuid.UUID) (*ent.Category, error) {
	return client.Category.Query().Where(category.ID(categoryId), category.StoreIDIsNil()).Only(ctx)
}
