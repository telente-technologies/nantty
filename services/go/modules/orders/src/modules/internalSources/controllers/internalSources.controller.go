package controllers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	getordersharecard "nantty/modules/orders/src/modules/internalSources/queries/getOrderShareCard"
	listbuyerstores "nantty/modules/orders/src/modules/internalSources/queries/listBuyerStores"
	liststorepurchasers "nantty/modules/orders/src/modules/internalSources/queries/listStorePurchasers"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type InternalSourcesController struct {
	Container *container.Container
}

func readBoundedInteger(request *http.Request, name string, fallback, minimum, maximum int, collected *utils.Issues) int {
	raw := request.URL.Query().Get(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < minimum || value > maximum {
		collected.Add(name, "must be between "+strconv.Itoa(minimum)+" and "+strconv.Itoa(maximum))
	}
	return value
}

func (controller InternalSourcesController) ListStorePurchasers(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	storeId, err := utils.PathIdentifier(request, "storeId")
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	var collected utils.Issues
	retentionDays := readBoundedInteger(request, "retentionDays", 180, 1, 365, &collected)
	minimumOrders := readBoundedInteger(request, "minimumOrders", 1, 1, 100, &collected)
	limit := readBoundedInteger(request, "limit", 500, 1, 1000, &collected)
	if err := collected.AsError(); err != nil {
		responder.Error(writer, request, err)
		return
	}
	page, err := (liststorepurchasers.Handler{Container: controller.Container}).Execute(request.Context(), liststorepurchasers.Query{
		StoreId: storeId, PurchasedFrom: controller.Container.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour), MinimumOrders: minimumOrders, Cursor: request.URL.Query().Get("cursor"), Limit: limit,
	})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller InternalSourcesController) ListBuyerStores(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	buyerId, err := utils.PathIdentifier(request, "userId")
	var collected utils.Issues
	limit := readBoundedInteger(request, "limit", 50, 1, 200, &collected)
	if err == nil {
		err = collected.AsError()
	}
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	page, err := (listbuyerstores.Handler{Container: controller.Container}).Execute(request.Context(), listbuyerstores.Query{BuyerId: buyerId, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller InternalSourcesController) ListInboxTeam(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	storeId, err := utils.PathIdentifier(request, "storeId")
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	catalog, err := controller.Container.Catalog()
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	accountIds, err := catalog.ListStoreTeamWithPermission(request.Context(), storeId, "messages:manage")
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"accountIds": accountIds})
}

func (controller InternalSourcesController) GetOrderShareCard(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	viewerId, err := uuid.Parse(request.URL.Query().Get("viewerId"))
	if err != nil {
		var collected utils.Issues
		collected.Add("viewerId", "must be an account id")
		responder.Error(writer, request, collected.AsError())
		return
	}
	team := func(ctx context.Context, storeId uuid.UUID) ([]uuid.UUID, error) {
		catalog, err := controller.Container.Catalog()
		if err != nil {
			return nil, err
		}
		return catalog.ListStoreTeamWithPermission(ctx, storeId, "orders:view")
	}
	card, err := (getordersharecard.Handler{Container: controller.Container, Team: team}).Execute(request.Context(), getordersharecard.Query{OrderId: orderId, ViewerId: viewerId})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, getordersharecard.Present(card))
}

func (controller InternalSourcesController) VerifyBusinessMessagingStoreAccess(writer http.ResponseWriter, request *http.Request) {
	var body struct {
		AccountId string `json:"accountId"`
		StoreId   string `json:"storeId"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	accountId, accountErr := uuid.Parse(body.AccountId)
	storeId, storeErr := uuid.Parse(body.StoreId)
	if accountErr != nil || storeErr != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_STORE_AUTHORIZATION", "Account and store identifiers must be valid."))
		return
	}
	catalog, err := controller.Container.Catalog()
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	access, found, err := catalog.FindStoreAccessForAccount(request.Context(), accountId, &storeId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if !found || access.StoreId != storeId || access.StoreStatus != "active" || !access.Allows("developer:manage") {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewForbiddenError("The account is not authorized to connect this store to a business messaging application."))
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{
		"storeId": access.StoreId.String(), "storeName": access.StoreName,
		"ownerAccountId": access.OwnerAccountId.String(), "role": access.Role,
	})
}
