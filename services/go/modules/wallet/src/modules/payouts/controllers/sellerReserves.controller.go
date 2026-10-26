package controllers

import (
	"net/http"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/services"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type SellerReservesController struct {
	Application *payouts.Application
	Reserves    services.SellerReserves
}

type flagSellerRequest struct {
	Reason     string `json:"reason"`
	ReserveBps int64  `json:"reserveBps"`
	HoldDays   int64  `json:"holdDays"`
}

func (controller SellerReservesController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Application.Container.Resources.Logger, err)
}

func (controller SellerReservesController) List(writer http.ResponseWriter, request *http.Request) {
	views, err := controller.Reserves.ListActive(request.Context(), ledgerutils.ReadPageLimit(request))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": views, "nextCursor": nil})
}

func (controller SellerReservesController) Flag(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	sellerUserId := request.PathValue("sellerUserId")
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body flagSellerRequest) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("sellerUserId", sellerUserId, 1, 80)
		collector.RequireLength("reason", body.Reason, 3, 300)
		collector.RequireRange("reserveBps", body.ReserveBps, 0, 5000)
		collector.RequireRange("holdDays", body.HoldDays, 0, 180)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Reserves.FlagSeller(request.Context(), staff.Id, sellerUserId, body.Reason, body.ReserveBps, int(body.HoldDays))
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller SellerReservesController) Release(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	if err := controller.Reserves.ReleaseSeller(request.Context(), staff.Id, request.PathValue("sellerUserId")); err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}
