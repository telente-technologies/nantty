package controllers

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/google/uuid"

	postdisputemessage "zudomart/modules/escrow/src/modules/disputes/commands/postDisputeMessage"
	getdispute "zudomart/modules/escrow/src/modules/disputes/queries/getDispute"
	listdisputes "zudomart/modules/escrow/src/modules/disputes/queries/listDisputes"
	"zudomart/modules/escrow/src/modules/disputes/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
)

type storeDisputeResponseRequest struct {
	AuthorUserId string `json:"authorUserId"`
	Text         string `json:"text"`
}

func (controller DisputesController) RequireInternalToken(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		expected := controller.Application.Container.Settings.InternalApiToken
		if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
			httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
			return
		}
		next(writer, request)
	})
}

func (controller DisputesController) ListStoreDisputes(writer http.ResponseWriter, request *http.Request) {
	query := listdisputes.Query{Limit: ledgerutils.ReadPageLimit(request), Status: request.URL.Query().Get("status"), StoreId: request.PathValue("storeId")}
	cursor, err := readCursor(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query.AfterId = cursor
	page, err := listdisputes.Handler{Application: controller.Application}.Execute(request.Context(), query)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller DisputesController) GetStoreDispute(writer http.ResponseWriter, request *http.Request) {
	disputeId, err := uuid.Parse(request.PathValue("disputeId"))
	if err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	view, err := getdispute.Handler{Application: controller.Application}.Execute(request.Context(), getdispute.Query{DisputeId: disputeId, StoreId: request.PathValue("storeId")})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller DisputesController) RespondToStoreDispute(writer http.ResponseWriter, request *http.Request) {
	disputeId, err := uuid.Parse(request.PathValue("disputeId"))
	if err != nil {
		controller.fail(writer, request, httpserver.ErrNotFound)
		return
	}
	key, err := ledgerutils.ReadRequiredIdempotencyKey(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body storeDisputeResponseRequest) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("authorUserId", body.AuthorUserId, 1, 80)
		collector.RequireLength("text", strings.TrimSpace(body.Text), 10, 2000)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	storeId := request.PathValue("storeId")
	_, _, err = postdisputemessage.Handler{Application: controller.Application}.Execute(request.Context(), postdisputemessage.Command{IdempotencyKey: key, Input: services.DisputeMessageInput{
		DisputeId: disputeId, AuthorUserId: body.AuthorUserId, StoreId: storeId, Text: strings.TrimSpace(body.Text),
	}})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := getdispute.Handler{Application: controller.Application}.Execute(request.Context(), getdispute.Query{DisputeId: disputeId, StoreId: storeId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}
