package controllers

import (
	"net/http"

	"zudomart/modules/creators/src/modules/creatorProgram/dtos"
	"zudomart/modules/creators/src/modules/creatorProgram/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type CreatorProgramController struct {
	Program services.CreatorProgram
}

func (controller CreatorProgramController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Program.Container.Resources.Logger, err)
}

func (controller CreatorProgramController) ListCreatorTiers(writer http.ResponseWriter, request *http.Request) {
	tiers, err := controller.Program.ListCreatorTiers(request.Context())
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(tiers, ""))
}

func (controller CreatorProgramController) UpdateCreatorTier(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.UpdateCreatorTierRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireRange("giftShareBps", body.GiftShareBps, 0, 7000)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	tier, err := controller.Program.UpdateCreatorTierShare(request.Context(), staff.Id, request.PathValue("tierId"), body.GiftShareBps)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, tier)
}

func (controller CreatorProgramController) SetCreatorMembership(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	userId := request.PathValue("userId")
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.SetCreatorMembershipRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireUuid("userId", userId)
		collector.RequireLength("tierId", body.TierId, 1, 40)
		collector.RequireOneOf("status", body.Status, "approved", "suspended")
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	membership, err := controller.Program.SetCreatorProgramMembership(request.Context(), staff.Id, userId, body.TierId, body.Status)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, membership)
}
