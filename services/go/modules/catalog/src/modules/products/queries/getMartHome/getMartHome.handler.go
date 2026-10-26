package getmarthome

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

type MartHome struct {
	Banners                []any                `json:"banners"`
	SalesOfTheDayImageUrl  *string              `json:"salesOfTheDayImageUrl"`
	FeaturedBrandsImageUrl *string              `json:"featuredBrandsImageUrl"`
	NewArrivalsImageUrl    *string              `json:"newArrivalsImageUrl"`
	Categories             []types.CategoryView `json:"categories"`
}

func (handler Handler) Execute(ctx context.Context, _ Query) (MartHome, error) {
	rows, err := handler.Container.Client.Category.Query().Where(category.StoreIDIsNil(), category.Active(true), category.ParentIDIsNil()).
		Order(ent.Asc(category.FieldSortOrder), ent.Asc(category.FieldName)).All(ctx)
	if err != nil {
		return MartHome{}, err
	}
	home := MartHome{Banners: []any{}, Categories: make([]types.CategoryView, 0, len(rows))}
	for _, row := range rows {
		home.Categories = append(home.Categories, services.CategoryViewOf(row))
	}
	return home, nil
}
