package listproductoptions

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/platform/httpserver"
	"zudomart/platform/money"
)

type ProductOptionView struct {
	ProductId string      `json:"productId"`
	Name      string      `json:"name"`
	ImageUrl  *string     `json:"imageUrl"`
	Price     money.Money `json:"price"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[ProductOptionView], error) {
	filter := handler.Container.Client.Product.Query().Where(product.StoreID(query.Store.StoreId), product.Status(enums.ProductActive))
	if text := strings.TrimSpace(query.Text); text != "" {
		filter = filter.Where(product.NameContainsFold(text))
	}
	rows, err := filter.Order(ent.Asc(product.FieldName)).Limit(20).All(ctx)
	if err != nil || len(rows) == 0 {
		return httpserver.NewCursorPage([]ProductOptionView{}, ""), err
	}
	productIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		productIds = append(productIds, row.ID)
	}
	media, err := handler.Container.Client.ProductMedia.Query().Where(productmedia.ProductIDIn(productIds...)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return httpserver.CursorPage[ProductOptionView]{}, err
	}
	images := map[uuid.UUID]*string{}
	for _, item := range media {
		if _, taken := images[item.ProductID]; !taken {
			images[item.ProductID] = &item.URL
		}
	}
	options := make([]ProductOptionView, 0, len(rows))
	for _, row := range rows {
		options = append(options, ProductOptionView{ProductId: row.ID.String(), Name: row.Name, ImageUrl: images[row.ID], Price: money.Money{AmountMinor: row.MinPriceMinor, Currency: money.CurrencyCode(row.Currency)}})
	}
	return httpserver.NewCursorPage(options, ""), nil
}
