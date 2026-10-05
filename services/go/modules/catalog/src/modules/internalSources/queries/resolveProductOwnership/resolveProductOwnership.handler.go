package resolveproductownership

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/platform/money"
)

type Query struct {
	StoreId    uuid.UUID
	ProductIds []uuid.UUID
}

type OwnedProduct struct {
	Id       string      `json:"id"`
	Title    string      `json:"title"`
	Price    money.Money `json:"price"`
	ImageUrl *string     `json:"imageUrl"`
}

type Result struct {
	Owned    []string       `json:"owned"`
	Products []OwnedProduct `json:"products"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	result := Result{Owned: []string{}, Products: []OwnedProduct{}}
	if len(query.ProductIds) == 0 {
		return result, nil
	}
	rows, err := handler.Container.Client.Product.Query().
		Where(product.StoreID(query.StoreId), product.IDIn(query.ProductIds...), product.StatusNEQ(enums.ProductArchived)).
		Order(ent.Asc(product.FieldID)).All(ctx)
	if err != nil || len(rows) == 0 {
		return result, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.ID)
	}
	media, err := handler.Container.Client.ProductMedia.Query().Where(productmedia.ProductIDIn(identifiers...)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return result, err
	}
	firstImage := map[uuid.UUID]string{}
	for _, item := range media {
		if _, seen := firstImage[item.ProductID]; !seen {
			firstImage[item.ProductID] = item.URL
		}
	}
	for _, row := range rows {
		view := OwnedProduct{Id: row.ID.String(), Title: row.Name, Price: money.Money{AmountMinor: row.MinPriceMinor, Currency: money.CurrencyCode(row.Currency)}}
		if url, found := firstImage[row.ID]; found {
			view.ImageUrl = &url
		}
		result.Owned = append(result.Owned, view.Id)
		result.Products = append(result.Products, view)
	}
	return result, nil
}
