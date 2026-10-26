package listsitemapentries

import (
	"context"
	"time"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/store"
	listproducts "nantty/modules/catalog/src/modules/products/queries/listProducts"
)

const PageSize = 1000

type Query struct {
	Kind string
	Page int
}

type Entry struct {
	Id        string    `json:"id"`
	Name      string    `json:"name"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Result struct {
	Entries    []Entry `json:"entries"`
	TotalPages int     `json:"totalPages"`
}

type Handler struct {
	Container *container.Container
}

func pages(total int) int { return max(1, (total+PageSize-1)/PageSize) }

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	offset := (query.Page - 1) * PageSize
	result := Result{Entries: []Entry{}}
	if query.Kind == "stores" {
		request := handler.Container.Client.Store.Query().Where(store.Status(enums.StoreActive), store.ModerationVisibilityIn(enums.ModerationVisible, enums.ModerationRestricted))
		total, err := request.Clone().Count(ctx)
		if err != nil {
			return result, err
		}
		rows, err := request.Order(ent.Asc(store.FieldID)).Offset(offset).Limit(PageSize).All(ctx)
		for _, row := range rows {
			result.Entries = append(result.Entries, Entry{Id: row.ID.String(), Name: row.Name, UpdatedAt: row.UpdatedAt})
		}
		result.TotalPages = pages(total)
		return result, err
	}
	request := handler.Container.Client.Product.Query().Where(listproducts.PublicListingConditions()...)
	total, err := request.Clone().Count(ctx)
	if err != nil {
		return result, err
	}
	rows, err := request.Order(ent.Asc(product.FieldID)).Offset(offset).Limit(PageSize).All(ctx)
	for _, row := range rows {
		result.Entries = append(result.Entries, Entry{Id: row.ID.String(), Name: row.Name, UpdatedAt: row.UpdatedAt})
	}
	result.TotalPages = pages(total)
	return result, err
}
