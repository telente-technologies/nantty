package listproductbundles

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/productbundle"
	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.ProductBundleView], error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[dtos.ProductBundleView]{}, err
	}
	request := handler.Container.Client.ProductBundle.Query().Where(productbundle.StoreID(query.StoreId))
	if query.Status != "" {
		request.Where(productbundle.Status(query.Status))
	}
	if after != nil {
		request.Where(productbundle.IDLT(*after))
	}
	rows, err := request.Order(ent.Desc(productbundle.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.ProductBundleView]{}, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = utils.IdentifierCursor(rows[len(rows)-1].ID)
	}
	views, err := services.PresentProductBundles(ctx, handler.Container, rows)
	return httpserver.NewCursorPage(views, nextCursor), err
}
