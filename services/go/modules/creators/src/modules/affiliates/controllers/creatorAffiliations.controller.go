package controllers

import (
	"net/http"

	"nantty/modules/creators/src/modules/affiliates/dtos"
	"nantty/modules/creators/src/modules/affiliates/services"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

type AffiliatesController struct {
	Affiliates services.Affiliates
}

func (controller AffiliatesController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Affiliates.Container.Resources.Logger, err)
}

func (controller AffiliatesController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if body == nil {
		writer.WriteHeader(status)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller AffiliatesController) MyAffiliations(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, err := controller.Affiliates.ListMyAffiliations(request.Context(), principal.UserId)
	controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, ""), err)
}

func (controller AffiliatesController) RequestAffiliation(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.AffiliationRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		if body.ProductId == "" && body.StoreId == "" {
			collector.Add("productId", "choose a store or a product")
		}
		collector.RequireLength("productId", body.ProductId, 0, 80)
		collector.RequireLength("storeId", body.StoreId, 0, 80)
		collector.RequireLength("message", body.Message, 0, 500)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Affiliates.RequestAffiliation(request.Context(), services.AffiliationRequest{CreatorId: principal.UserId, StoreId: body.StoreId, ProductId: body.ProductId, Message: body.Message})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller AffiliatesController) LeaveAffiliation(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	controller.respond(writer, request, http.StatusNoContent, nil, controller.Affiliates.LeaveAffiliation(request.Context(), principal.UserId, request.PathValue("affiliationId")))
}

func (controller AffiliatesController) AffiliatedProducts(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, err := controller.Affiliates.ListAffiliatedProducts(request.Context(), principal.UserId)
	controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, ""), err)
}
