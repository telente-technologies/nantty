package controllers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/predicate"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/money"
)

type CustomersController struct {
	Container *container.Container
}

func (controller CustomersController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller CustomersController) filtered(request *http.Request) ([]services.CustomerView, error) {
	store := middlewares.StoreAccessFrom(request.Context())
	customers, err := services.LoadStoreCustomers(request.Context(), controller.Container, store.StoreId, store.Currency)
	if err != nil {
		return nil, err
	}
	query := request.URL.Query()
	sortKey := query.Get("sort")
	descending := query.Get("direction") != "asc"
	if sortKey == "name" && query.Get("direction") == "" {
		descending = false
	}
	if tag := query.Get("tag"); tag != "" {
		tagged := []services.CustomerView{}
		for _, customer := range customers {
			if services.CustomerHasTag(customer, tag) {
				tagged = append(tagged, customer)
			}
		}
		customers = tagged
	}
	if customers, err = services.FilterCustomersBySegment(request.Context(), controller.Container, store, query.Get("segmentId"), customers); err != nil {
		return nil, err
	}
	return services.FilterAndSortCustomers(customers, query.Get("q"), query.Get("type"), sortKey, descending), nil
}

func (controller CustomersController) List(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 200)
	var customers []services.CustomerView
	if err == nil {
		customers, err = controller.filtered(request)
	}
	offset := 0
	if raw := request.URL.Query().Get("cursor"); err == nil && raw != "" {
		parts, cursorError := utils.DecodeCursor(raw, 1)
		if cursorError != nil {
			err = cursorError
		} else if offset, cursorError = strconv.Atoi(parts[0]); cursorError != nil || offset < 0 {
			err = httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
		}
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	end := min(offset+limit, len(customers))
	page := customers[min(offset, len(customers)):end]
	next := ""
	if end < len(customers) {
		next = utils.EncodeCursor(strconv.Itoa(end))
	}
	controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(page, next), nil)
}

type summaryView struct {
	TotalCustomers        int              `json:"totalCustomers"`
	NewThisMonth          int              `json:"newThisMonth"`
	ReturningCustomers    int              `json:"returningCustomers"`
	RepeatRateBasisPoints int              `json:"repeatRateBasisPoints"`
	AverageOrderValue     money.Money      `json:"averageOrderValue"`
	TotalRevenue          money.Money      `json:"totalRevenue"`
	Growth                []map[string]any `json:"growth"`
}

func (controller CustomersController) Summary(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	customers, err := services.LoadStoreCustomers(request.Context(), controller.Container, store.StoreId, store.Currency)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	now := controller.Container.Now().UTC()
	view := summaryView{AverageOrderValue: money.Money{Currency: store.Currency}, TotalRevenue: money.Money{Currency: store.Currency}, Growth: []map[string]any{}}
	withOrders, orders := 0, 0
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	newByMonth, returningByMonth := map[string]int{}, map[string]int{}
	for _, customer := range customers {
		view.TotalCustomers++
		if customer.PurchasesCount == 0 {
			continue
		}
		withOrders++
		orders += customer.PurchasesCount
		view.TotalRevenue.AmountMinor += customer.TotalSpent.AmountMinor
		if customer.PurchasesCount >= 2 {
			view.ReturningCustomers++
		}
		if !customer.FirstPurchaseAt.Before(monthStart) {
			view.NewThisMonth++
		}
		newByMonth[customer.FirstPurchaseAt.UTC().Format("2006-01")]++
		if customer.PurchasesCount >= 2 {
			returningByMonth[customer.LastPurchaseAt.UTC().Format("2006-01")]++
		}
	}
	if withOrders > 0 {
		view.RepeatRateBasisPoints = view.ReturningCustomers * 10_000 / withOrders
	}
	if orders > 0 {
		view.AverageOrderValue.AmountMinor = view.TotalRevenue.AmountMinor / int64(orders)
	}
	for offset := 5; offset >= 0; offset-- {
		key := time.Date(now.Year(), now.Month()-time.Month(offset), 1, 0, 0, 0, 0, time.UTC).Format("2006-01")
		view.Growth = append(view.Growth, map[string]any{"month": key, "newCustomers": newByMonth[key], "returningCustomers": returningByMonth[key]})
	}
	controller.respond(writer, request, http.StatusOK, view, nil)
}

func (controller CustomersController) findCustomer(request *http.Request) (services.CustomerView, error) {
	identifier, err := utils.PathIdentifier(request, "customerId")
	if err != nil {
		return services.CustomerView{}, err
	}
	store := middlewares.StoreAccessFrom(request.Context())
	customers, err := services.LoadStoreCustomers(request.Context(), controller.Container, store.StoreId, store.Currency)
	if err != nil {
		return services.CustomerView{}, err
	}
	for _, customer := range customers {
		if customer.Id == identifier.String() {
			customer.Notes, err = services.LoadCustomerNotes(request.Context(), controller.Container, store.StoreId, identifier)
			return customer, err
		}
	}
	return services.CustomerView{}, ordererrors.CustomerNotFound
}

func (controller CustomersController) Get(writer http.ResponseWriter, request *http.Request) {
	customer, err := controller.findCustomer(request)
	controller.respond(writer, request, http.StatusOK, customer, err)
}

func (controller CustomersController) Purchases(writer http.ResponseWriter, request *http.Request) {
	customer, err := controller.findCustomer(request)
	limit, limitError := utils.ReadPageLimit(request, 20, 100)
	if err == nil {
		err = limitError
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	conditions := []predicate.OrderGroup{ordergroup.StoreID(store.StoreId), ordergroup.BuyerAccountID(uuid.MustParse(customer.Id)), ordergroup.PaymentStatusNEQ("pending")}
	after, err := utils.DecodeIdentifierCursor(request.URL.Query().Get("cursor"))
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	if after != nil {
		conditions = append(conditions, ordergroup.IDLT(*after))
	}
	rows, err := controller.Container.Client.OrderGroup.Query().Where(conditions...).Order(ent.Desc(ordergroup.FieldID)).Limit(limit + 1).All(request.Context())
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	counts, err := controller.itemCounts(request.Context(), rows)
	page := utils.PageFromOverfetchedRows(rows, limit, func(row *ent.OrderGroup) map[string]any {
		return map[string]any{"kind": "online_order", "id": row.ID.String(), "reference": row.Reference, "status": row.Status,
			"total": money.Money{AmountMinor: row.TotalMinor, Currency: money.CurrencyCode(row.Currency)}, "itemsCount": counts[row.ID], "createdAt": row.CreatedAt}
	}, func(row *ent.OrderGroup) string { return utils.IdentifierCursor(row.ID) })
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller CustomersController) itemCounts(ctx context.Context, rows []*ent.OrderGroup) (map[uuid.UUID]int, error) {
	items, err := services.LoadItemsByGroup(ctx, controller.Container, services.UniqueIdentifiers(rows, func(row *ent.OrderGroup) uuid.UUID { return row.ID }))
	counts := map[uuid.UUID]int{}
	for groupId, list := range items {
		for _, item := range list {
			counts[groupId] += item.Quantity
		}
	}
	return counts, err
}

func (controller CustomersController) AddNote(writer http.ResponseWriter, request *http.Request) {
	customer, err := controller.findCustomer(request)
	var body struct {
		Body string `json:"body"`
	}
	if err == nil {
		var collected utils.Issues
		if err = httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err == nil {
			collected.CheckLength("body", body.Body, 2, 1000)
			err = collected.AsError()
		}
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	accountId := middlewares.AccountIdFrom(request.Context())
	name := ""
	if profiles, lookup := controller.Container.Users.PersonalProfilesByAccount(request.Context(), []uuid.UUID{accountId}); lookup == nil {
		name = profiles[accountId].Name
	}
	store := middlewares.StoreAccessFrom(request.Context())
	if err = controller.Container.Client.CustomerNote.Create().SetStoreID(store.StoreId).SetBuyerAccountID(uuid.MustParse(customer.Id)).SetAuthorAccountID(accountId).SetAuthorName(name).SetBody(body.Body).Exec(request.Context()); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	customer.Notes, err = services.LoadCustomerNotes(request.Context(), controller.Container, store.StoreId, uuid.MustParse(customer.Id))
	controller.respond(writer, request, http.StatusCreated, customer, err)
}

func (controller CustomersController) Export(writer http.ResponseWriter, request *http.Request) {
	customers, err := controller.filtered(request)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	result := services.ReportResult{Columns: []services.ReportColumn{{Key: "name", Label: "Name", Kind: "text"}, {Key: "phone", Label: "Phone", Kind: "text"}, {Key: "username", Label: "Nantty username", Kind: "text"},
		{Key: "city", Label: "City", Kind: "text"}, {Key: "spent", Label: "Total spent", Kind: "money"}, {Key: "orders", Label: "Orders", Kind: "number"}}}
	for _, customer := range customers {
		result.Rows = append(result.Rows, map[string]any{"name": customer.Name, "phone": derefText(customer.Phone), "username": derefText(customer.ZudomartUsername),
			"city": derefText(customer.City), "spent": customer.TotalSpent, "orders": customer.PurchasesCount})
	}
	content, err := services.RenderReportCsv(result, store.Currency)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	writer.Header().Set("Content-Disposition", `attachment; filename="customers.csv"`)
	_, _ = writer.Write(content)
}

func derefText(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
