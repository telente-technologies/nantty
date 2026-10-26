package liststorepurchasers

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type AudienceMember struct {
	AccountId    string `json:"accountId"`
	LastActiveAt string `json:"lastActiveAt"`
	Interactions int    `json:"interactions"`
}

type purchaserRow struct {
	BuyerAccountId uuid.UUID `json:"buyer_account_id"`
	Orders         int       `json:"orders"`
	LastOrderAt    time.Time `json:"last_order_at"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[AudienceMember], error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[AudienceMember]{}, err
	}
	request := handler.Container.Client.OrderGroup.Query().Where(ordergroup.StoreID(query.StoreId), ordergroup.CreatedAtGTE(query.PurchasedFrom),
		ordergroup.PaymentStatusIn(enums.PaymentPaid, enums.PaymentPartiallyRefunded))
	if after != nil {
		request.Where(ordergroup.BuyerAccountIDGT(*after))
	}
	var rows []purchaserRow
	err = request.Order(ent.Asc(ordergroup.FieldBuyerAccountID)).Limit(query.Limit+1).GroupBy(ordergroup.FieldBuyerAccountID).
		Aggregate(ent.As(ent.Count(), "orders"), ent.As(ent.Max(ordergroup.FieldCreatedAt), "last_order_at")).Scan(ctx, &rows)
	if err != nil {
		return httpserver.CursorPage[AudienceMember]{}, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = utils.IdentifierCursor(rows[len(rows)-1].BuyerAccountId)
	}
	qualifying := make([]uuid.UUID, 0, len(rows))
	byAccount := map[uuid.UUID]purchaserRow{}
	for _, row := range rows {
		if row.Orders >= query.MinimumOrders {
			qualifying = append(qualifying, row.BuyerAccountId)
			byAccount[row.BuyerAccountId] = row
		}
	}
	consenting, err := handler.Container.Users.AccountsAllowingPersonalizedAds(ctx, qualifying)
	if err != nil {
		return httpserver.CursorPage[AudienceMember]{}, err
	}
	members := make([]AudienceMember, 0, len(consenting))
	for _, accountId := range consenting {
		row := byAccount[accountId]
		members = append(members, AudienceMember{AccountId: accountId.String(), LastActiveAt: row.LastOrderAt.UTC().Format(time.RFC3339), Interactions: row.Orders})
	}
	return httpserver.NewCursorPage(members, nextCursor), nil
}
