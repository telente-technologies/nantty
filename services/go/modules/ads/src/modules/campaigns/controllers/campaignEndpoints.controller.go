package controllers

import (
	"net/http"

	"nantty/modules/ads/src/modules/campaigns/commands/applyBulkAction"
	createcampaignbundle "nantty/modules/ads/src/modules/campaigns/commands/createCampaignBundle"
	deletecampaign "nantty/modules/ads/src/modules/campaigns/commands/deleteCampaign"
	duplicatecampaign "nantty/modules/ads/src/modules/campaigns/commands/duplicateCampaign"
	submitcampaignforreview "nantty/modules/ads/src/modules/campaigns/commands/submitCampaignForReview"
	updatecampaign "nantty/modules/ads/src/modules/campaigns/commands/updateCampaign"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	getcampaign "nantty/modules/ads/src/modules/campaigns/queries/getCampaign"
	listcampaigns "nantty/modules/ads/src/modules/campaigns/queries/listCampaigns"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

func (controller CampaignsController) ListCampaigns(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		params := request.URL.Query()
		items, next, total, err := (listcampaigns.Handler{Container: controller.Container}).Execute(request.Context(), listcampaigns.Query{
			AccountId: scope.account, UserId: scope.user, Status: params.Get("status"), Objective: params.Get("objective"), Search: params.Get("search"), From: scope.from, To: scope.to, Cursor: scope.cursor, Limit: scope.limit,
		})
		if err != nil {
			return err
		}
		writePage(writer, items, next, total)
		return nil
	})
}

func (controller CampaignsController) CreateCampaign(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		var body dtos.CampaignDraftSubmission
		if err := controller.decode(writer, request, &body); err != nil {
			return err
		}
		result, err := (createcampaignbundle.Handler{Container: controller.Container}).Execute(request.Context(), createcampaignbundle.Command{AccountId: scope.account, UserId: scope.user, Submission: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, result)
		return nil
	})
}

func (controller CampaignsController) GetCampaign(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		campaignId, err := utils.PathIdentifier(request, "campaignId")
		if err != nil {
			return err
		}
		campaign, err := (getcampaign.Handler{Container: controller.Container}).Execute(request.Context(), getcampaign.Query{AccountId: scope.account, CampaignId: campaignId, UserId: scope.user, From: scope.from, To: scope.to})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, campaign)
		return nil
	})
}

func (controller CampaignsController) UpdateCampaign(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		campaignId, err := utils.PathIdentifier(request, "campaignId")
		if err != nil {
			return err
		}
		var patch dtos.CampaignPatch
		if err := controller.decode(writer, request, &patch); err != nil {
			return err
		}
		campaign, err := (updatecampaign.Handler{Container: controller.Container}).Execute(request.Context(), updatecampaign.Command{AccountId: scope.account, CampaignId: campaignId, UserId: scope.user, Patch: patch})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, campaign)
		return nil
	})
}

func (controller CampaignsController) DeleteCampaign(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		campaignId, err := utils.PathIdentifier(request, "campaignId")
		if err != nil {
			return err
		}
		if err := (deletecampaign.Handler{Container: controller.Container}).Execute(request.Context(), deletecampaign.Command{AccountId: scope.account, CampaignId: campaignId, UserId: scope.user}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (controller CampaignsController) SubmitCampaign(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		campaignId, err := utils.PathIdentifier(request, "campaignId")
		if err != nil {
			return err
		}
		campaign, err := (submitcampaignforreview.Handler{Container: controller.Container}).Execute(request.Context(), submitcampaignforreview.Command{AccountId: scope.account, CampaignId: campaignId, UserId: scope.user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, campaign)
		return nil
	})
}

func (controller CampaignsController) DuplicateCampaign(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		campaignId, err := utils.PathIdentifier(request, "campaignId")
		if err != nil {
			return err
		}
		campaign, err := (duplicatecampaign.Handler{Container: controller.Container}).Execute(request.Context(), duplicatecampaign.Command{AccountId: scope.account, CampaignId: campaignId, UserId: scope.user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, campaign)
		return nil
	})
}

func (controller CampaignsController) BulkAction(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		var body dtos.BulkActionRequest
		if err := controller.decode(writer, request, &body); err != nil {
			return err
		}
		if err := applybulkaction.Validate(body); err != nil {
			return err
		}
		result := (applybulkaction.Handler{Container: controller.Container}).Execute(request.Context(), applybulkaction.Command{AccountId: scope.account, UserId: scope.user, Request: body})
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}
