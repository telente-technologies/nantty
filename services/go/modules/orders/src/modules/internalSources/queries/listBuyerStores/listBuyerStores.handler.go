package listbuyerstores

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type ShoppedStore struct {
	StoreId         string `json:"storeId"`
	StoreName       string `json:"storeName"`
	CompletedOrders int    `json:"completedOrders"`
	LastOrderAt     string `json:"lastOrderAt"`
}

type storeRow struct {
	StoreId     uuid.UUID `json:"store_id"`
	Orders      int       `json:"orders"`
	LastOrderAt time.Time `json:"last_order_at"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[ShoppedStore], error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[ShoppedStore]{}, err
	}
	request := handler.Container.Client.OrderGroup.Query().Where(ordergroup.BuyerAccountID(query.BuyerId), ordergroup.Status(enums.StatusCompleted))
	if after != nil {
		request.Where(ordergroup.StoreIDGT(*after))
	}
	var rows []storeRow
	err = request.Order(ent.Asc(ordergroup.FieldStoreID)).Limit(query.Limit+1).GroupBy(ordergroup.FieldStoreID).
		Aggregate(ent.As(ent.Count(), "orders"), ent.As(ent.Max(ordergroup.FieldCreatedAt), "last_order_at")).Scan(ctx, &rows)
	if err != nil {
		return httpserver.CursorPage[ShoppedStore]{}, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = utils.IdentifierCursor(rows[len(rows)-1].StoreId)
	}
	names := map[uuid.UUID]string{}
	if catalog, portError := handler.Container.Catalog(); portError == nil && len(rows) > 0 {
		storeIds := make([]uuid.UUID, 0, len(rows))
		for _, row := range rows {
			storeIds = append(storeIds, row.StoreId)
		}
		if stores, describeError := catalog.DescribeStores(ctx, storeIds); describeError == nil {
			for storeId, store := range stores {
				names[storeId] = store.Name
			}
		}
	}
	stores := make([]ShoppedStore, 0, len(rows))
	for _, row := range rows {
		stores = append(stores, ShoppedStore{StoreId: row.StoreId.String(), StoreName: names[row.StoreId], CompletedOrders: row.Orders, LastOrderAt: row.LastOrderAt.UTC().Format(time.RFC3339)})
	}
	return httpserver.NewCursorPage(stores, nextCursor), nil
}
