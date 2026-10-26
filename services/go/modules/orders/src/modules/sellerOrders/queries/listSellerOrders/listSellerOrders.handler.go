package listsellerorders

import (
	"context"
	"strconv"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/predicate"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/types"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type Page struct {
	Data           []types.SellerOrderView `json:"data"`
	NextCursor     *string                 `json:"nextCursor"`
	CountsByStatus map[string]int          `json:"countsByStatus"`
}

var sortFields = map[string]string{"total": ordergroup.FieldTotalMinor, "buyer": ordergroup.FieldBuyerName, "status": ordergroup.FieldStatus}

func PaidOrdersOfStore(storeId uuid.UUID) predicate.OrderGroup {
	return ordergroup.And(ordergroup.StoreID(storeId), ordergroup.PaymentStatusNEQ(enums.PaymentPending))
}

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	counts, err := handler.countsByStatus(ctx, query.StoreId)
	if err != nil {
		return Page{}, err
	}
	conditions := []predicate.OrderGroup{PaidOrdersOfStore(query.StoreId)}
	if query.Status != "" && query.Status != "all" {
		conditions = append(conditions, ordergroup.Status(query.Status))
	}
	if query.From != nil {
		conditions = append(conditions, ordergroup.CreatedAtGTE(*query.From))
	}
	if query.To != nil {
		conditions = append(conditions, ordergroup.CreatedAtLT(query.To.AddDate(0, 0, 1)))
	}
	if query.Text != "" {
		conditions = append(conditions, ordergroup.Or(ordergroup.ReferenceContainsFold(query.Text), ordergroup.InvoiceNumberContainsFold(query.Text),
			ordergroup.BuyerNameContainsFold(query.Text), ordergroup.BuyerUsernameContainsFold(query.Text)))
	}
	field, sorted := sortFields[query.Sort]
	cursor, err := cursorCondition(query, field, sorted)
	if err != nil {
		return Page{}, err
	}
	if cursor != nil {
		conditions = append(conditions, cursor)
	}
	request := handler.Container.Client.OrderGroup.Query().Where(conditions...)
	direction := ent.Desc
	if !query.Descending && (sorted || query.Sort == "createdAt") {
		direction = ent.Asc
	}
	if sorted {
		request = request.Order(direction(field), direction(ordergroup.FieldID))
	} else {
		request = request.Order(direction(ordergroup.FieldID))
	}
	rows, err := request.Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return Page{}, err
	}
	page := Page{CountsByStatus: counts}
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next := cursorOf(rows[len(rows)-1], field, sorted)
		page.NextCursor = &next
	}
	page.Data, err = services.SellerOrderViews(ctx, handler.Container, rows, false)
	return page, err
}

func (handler Handler) countsByStatus(ctx context.Context, storeId uuid.UUID) (map[string]int, error) {
	counts := map[string]int{}
	for _, status := range enums.SellerStatuses {
		counts[status] = 0
	}
	var rows []struct {
		Status string `json:"status"`
		Count  int    `json:"count"`
	}
	err := handler.Container.Client.OrderGroup.Query().Where(PaidOrdersOfStore(storeId)).GroupBy(ordergroup.FieldStatus).Aggregate(ent.Count()).Scan(ctx, &rows)
	for _, row := range rows {
		counts[row.Status] = row.Count
	}
	return counts, err
}

func cursorOf(row *ent.OrderGroup, field string, sorted bool) string {
	if !sorted {
		return utils.IdentifierCursor(row.ID)
	}
	value := row.BuyerName
	switch field {
	case ordergroup.FieldTotalMinor:
		value = strconv.FormatInt(row.TotalMinor, 10)
	case ordergroup.FieldStatus:
		value = row.Status
	}
	return utils.EncodeCursor(value, row.ID.String())
}

func cursorCondition(query Query, field string, sorted bool) (predicate.OrderGroup, error) {
	if query.Cursor == "" {
		return nil, nil
	}
	descending := query.Descending || !(sorted || query.Sort == "createdAt")
	if !sorted {
		identifier, err := utils.DecodeIdentifierCursor(query.Cursor)
		if err != nil || identifier == nil {
			return nil, err
		}
		if descending {
			return ordergroup.IDLT(*identifier), nil
		}
		return ordergroup.IDGT(*identifier), nil
	}
	parts, err := utils.DecodeCursor(query.Cursor, 2)
	if err != nil {
		return nil, err
	}
	identifier, parseError := uuid.Parse(parts[1])
	var value any = parts[0]
	if field == ordergroup.FieldTotalMinor {
		var number int64
		if number, parseError = strconv.ParseInt(parts[0], 10, 64); parseError == nil {
			value = number
		}
	}
	if parseError != nil {
		return nil, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
	}
	return predicate.OrderGroup(func(selector *sql.Selector) {
		column, idColumn := selector.C(field), selector.C(ordergroup.FieldID)
		if descending {
			selector.Where(sql.Or(sql.LT(column, value), sql.And(sql.EQ(column, value), sql.LT(idColumn, identifier))))
			return
		}
		selector.Where(sql.Or(sql.GT(column, value), sql.And(sql.EQ(column, value), sql.GT(idColumn, identifier))))
	}), nil
}
