package controllers

import (
	"net/http"

	appealadrejection "zudomart/modules/ads/src/modules/campaigns/commands/appealAdRejection"
	createad "zudomart/modules/ads/src/modules/campaigns/commands/createAd"
	createadset "zudomart/modules/ads/src/modules/campaigns/commands/createAdSet"
	updatead "zudomart/modules/ads/src/modules/campaigns/commands/updateAd"
	updateadset "zudomart/modules/ads/src/modules/campaigns/commands/updateAdSet"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	getad "zudomart/modules/ads/src/modules/campaigns/queries/getAd"
	getadset "zudomart/modules/ads/src/modules/campaigns/queries/getAdSet"
	listadsets "zudomart/modules/ads/src/modules/campaigns/queries/listAdSets"
	listads "zudomart/modules/ads/src/modules/campaigns/queries/listAds"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

func (controller CampaignsController) ListAdSets(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		campaignId, err := optionalId(request, "campaignId")
		if err != nil {
			return err
		}
		items, next, total, err := (listadsets.Handler{Container: controller.Container}).Execute(request.Context(), listadsets.Query{AccountId: scope.account, UserId: scope.user, CampaignId: campaignId, From: scope.from, To: scope.to, Cursor: scope.cursor, Limit: scope.limit})
		if err != nil {
			return err
		}
		writePage(writer, items, next, total)
		return nil
	})
}

func (controller CampaignsController) CreateAdSet(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		var body dtos.CreateAdSetRequest
		if err := controller.decode(writer, request, &body); err != nil {
			return err
		}
		adSet, err := (createadset.Handler{Container: controller.Container}).Execute(request.Context(), createadset.Command{AccountId: scope.account, UserId: scope.user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, adSet)
		return nil
	})
}

func (controller CampaignsController) GetAdSet(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		adSetId, err := utils.PathIdentifier(request, "adSetId")
		if err != nil {
			return err
		}
		adSet, err := (getadset.Handler{Container: controller.Container}).Execute(request.Context(), getadset.Query{AccountId: scope.account, AdSetId: adSetId, UserId: scope.user, From: scope.from, To: scope.to})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, adSet)
		return nil
	})
}

func (controller CampaignsController) UpdateAdSet(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		adSetId, err := utils.PathIdentifier(request, "adSetId")
		if err != nil {
			return err
		}
		var patch dtos.AdSetPatch
		if err := controller.decode(writer, request, &patch); err != nil {
			return err
		}
		adSet, err := (updateadset.Handler{Container: controller.Container}).Execute(request.Context(), updateadset.Command{AccountId: scope.account, AdSetId: adSetId, UserId: scope.user, Patch: patch})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, adSet)
		return nil
	})
}

func (controller CampaignsController) ListAds(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		campaignId, err := optionalId(request, "campaignId")
		if err != nil {
			return err
		}
		adSetId, err := optionalId(request, "adSetId")
		if err != nil {
			return err
		}
		items, next, total, err := (listads.Handler{Container: controller.Container}).Execute(request.Context(), listads.Query{AccountId: scope.account, UserId: scope.user, CampaignId: campaignId, AdSetId: adSetId, ReviewStatus: request.URL.Query().Get("reviewStatus"), From: scope.from, To: scope.to, Cursor: scope.cursor, Limit: scope.limit})
		if err != nil {
			return err
		}
		writePage(writer, items, next, total)
		return nil
	})
}

func (controller CampaignsController) CreateAd(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		var body dtos.CreateAdRequest
		if err := controller.decode(writer, request, &body); err != nil {
			return err
		}
		created, err := (createad.Handler{Container: controller.Container}).Execute(request.Context(), createad.Command{AccountId: scope.account, UserId: scope.user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, created)
		return nil
	})
}

func (controller CampaignsController) GetAd(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		adId, err := utils.PathIdentifier(request, "adId")
		if err != nil {
			return err
		}
		row, err := (getad.Handler{Container: controller.Container}).Execute(request.Context(), getad.Query{AccountId: scope.account, AdId: adId, UserId: scope.user, From: scope.from, To: scope.to})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, row)
		return nil
	})
}

func (controller CampaignsController) UpdateAd(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		adId, err := utils.PathIdentifier(request, "adId")
		if err != nil {
			return err
		}
		var patch dtos.AdPatch
		if err := controller.decode(writer, request, &patch); err != nil {
			return err
		}
		row, err := (updatead.Handler{Container: controller.Container}).Execute(request.Context(), updatead.Command{AccountId: scope.account, AdId: adId, UserId: scope.user, Patch: patch})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, row)
		return nil
	})
}

func (controller CampaignsController) AppealAd(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(scope requestScope) error {
		adId, err := utils.PathIdentifier(request, "adId")
		if err != nil {
			return err
		}
		var body dtos.AppealRequest
		if err := controller.decode(writer, request, &body); err != nil {
			return err
		}
		if err := appealadrejection.Validate(body.Message); err != nil {
			return err
		}
		row, err := (appealadrejection.Handler{Container: controller.Container}).Execute(request.Context(), appealadrejection.Command{AccountId: scope.account, AdId: adId, UserId: scope.user, Message: body.Message})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, row)
		return nil
	})
}
