package controllers

import (
	"net/http"
	"zudomart/modules/live/src/container"
	awardengagementpoints "zudomart/modules/live/src/modules/points/commands/awardEngagementPoints"
	createlivesession "zudomart/modules/live/src/modules/sessions/commands/createLiveSession"
	endlivesession "zudomart/modules/live/src/modules/sessions/commands/endLiveSession"
	issuemediatoken "zudomart/modules/live/src/modules/sessions/commands/issueMediaToken"
	joinliveasviewer "zudomart/modules/live/src/modules/sessions/commands/joinLiveAsViewer"
	leaveliveasviewer "zudomart/modules/live/src/modules/sessions/commands/leaveLiveAsViewer"
	pinproducttolive "zudomart/modules/live/src/modules/sessions/commands/pinProductToLive"
	startlivesession "zudomart/modules/live/src/modules/sessions/commands/startLiveSession"
	unpinproductfromlive "zudomart/modules/live/src/modules/sessions/commands/unpinProductFromLive"
	updatelivemonetization "zudomart/modules/live/src/modules/sessions/commands/updateLiveMonetization"
	"zudomart/modules/live/src/modules/sessions/dtos"
	getlivesession "zudomart/modules/live/src/modules/sessions/queries/getLiveSession"
	listliveproducts "zudomart/modules/live/src/modules/sessions/queries/listLiveProducts"
	listsuggestedlives "zudomart/modules/live/src/modules/sessions/queries/listSuggestedLives"
	"zudomart/modules/live/src/modules/sessions/validators"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"

	"github.com/google/uuid"
)

type SessionsController struct {
	Container *container.Container
}

func (controller SessionsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller SessionsController) CreateLiveSession(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateCreateLiveRequest)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	input := types.CreateLiveSessionInput{
		Title: body.Title, Category: body.Category, Visibility: body.Visibility, StartNow: body.StartNow == nil || *body.StartNow,
		CountryCode: utils.ClientRegion(request), Monetization: buildMonetization(body.LiveAdSettings, body.AcceptedLiveAdTermsVersion, body.SponsorshipLine),
	}
	if input.Visibility == "" {
		input.Visibility = "public"
	}
	if body.StoreId != "" {
		storeId := uuid.MustParse(body.StoreId)
		input.StoreId = &storeId
	}
	for _, productId := range body.ProductIds {
		input.ProductIds = append(input.ProductIds, uuid.MustParse(productId))
	}
	view, err := (createlivesession.Handler{Container: controller.Container}).Execute(request.Context(), createlivesession.Command{Actor: actor, Input: input})
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (controller SessionsController) GetLiveSession(writer http.ResponseWriter, request *http.Request) {
	liveId, err := utils.PathIdentifier(request, "liveId")
	if err == nil {
		var view types.LiveSessionView
		actor, _ := utils.ActorFrom(request)
		if view, err = (getlivesession.Handler{Container: controller.Container}).Execute(request.Context(), getlivesession.Query{LiveId: liveId, Viewer: actor.UserId}); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
			return
		}
	}
	controller.responder().Error(writer, request, err)
}

func (controller SessionsController) ListSuggestedLives(writer http.ResponseWriter, request *http.Request) {
	actor, err := utils.ActorFrom(request)
	if err == nil {
		var views []types.SuggestedLiveView
		if views, err = (listsuggestedlives.Handler{Container: controller.Container}).Execute(request.Context(), listsuggestedlives.Query{Viewer: actor.UserId}); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(views, ""))
			return
		}
	}
	controller.responder().Error(writer, request, err)
}

func (controller SessionsController) StartLiveSession(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		view, err := (startlivesession.Handler{Container: controller.Container}).Execute(request.Context(), startlivesession.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller SessionsController) EndLiveSession(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		err := (endlivesession.Handler{Container: controller.Container}).Execute(request.Context(), endlivesession.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller SessionsController) JoinLive(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		err := (joinliveasviewer.Handler{Container: controller.Container}).Execute(request.Context(), joinliveasviewer.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller SessionsController) LeaveLive(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		err := (leaveliveasviewer.Handler{Container: controller.Container}).Execute(request.Context(), leaveliveasviewer.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (controller SessionsController) AcknowledgeReaction(writer http.ResponseWriter, request *http.Request) {
	if _, err := utils.DecodeAndValidate(writer, request, func(dtos.ReactionRequest) error { return nil }); err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller SessionsController) ShareLive(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		if _, err := utils.DecodeAndValidate(writer, request, func(dtos.ShareRequest) error { return nil }); err != nil {
			return err
		}
		if _, err := (awardengagementpoints.Handler{Container: controller.Container}).Execute(request.Context(), awardengagementpoints.Command{Actor: actor, LiveId: liveId, Action: "share"}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (controller SessionsController) UpdateLiveMonetization(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidateMonetizationRequest)
		if err != nil {
			return err
		}
		view, err := (updatelivemonetization.Handler{Container: controller.Container}).Execute(request.Context(), updatelivemonetization.Command{Actor: actor, LiveId: liveId, Input: buildMonetization(body.LiveAdSettings, body.AcceptedLiveAdTermsVersion, body.SponsorshipLine)})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (controller SessionsController) IssueMediaToken(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		token, err := (issuemediatoken.Handler{Container: controller.Container}).Execute(request.Context(), issuemediatoken.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, token)
		}
		return err
	})
}

func (controller SessionsController) PinProduct(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		body, err := utils.DecodeAndValidate(writer, request, validators.ValidatePinProductRequest)
		if err != nil {
			return err
		}
		products, err := (pinproducttolive.Handler{Container: controller.Container}).Execute(request.Context(), pinproducttolive.Command{Actor: actor, LiveId: liveId, ProductId: uuid.MustParse(body.ProductId)})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(products, ""))
		}
		return err
	})
}

func (controller SessionsController) UnpinProduct(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		products, err := (unpinproductfromlive.Handler{Container: controller.Container}).Execute(request.Context(), unpinproductfromlive.Command{Actor: actor, LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(products, ""))
		}
		return err
	})
}

func (controller SessionsController) ListLiveProducts(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(_ types.Actor, liveId uuid.UUID) error {
		products, err := (listliveproducts.Handler{Container: controller.Container}).Execute(request.Context(), listliveproducts.Query{LiveId: liveId})
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(products, ""))
		}
		return err
	})
}

func buildMonetization(adSettings *dtos.LiveAdSettingsRequest, termsVersion, sponsorshipLine *string) types.LiveMonetizationInput {
	monetization := types.LiveMonetizationInput{}
	if adSettings != nil {
		monetization.LiveAdSettings = &types.LiveAdSettingsInput{
			AllowAds: adSettings.AllowAds, Placements: adSettings.Placements, MaxInterruptions: adSettings.MaxInterruptions,
			MinIntervalMinutes: adSettings.MinIntervalMinutes, ShowAdIndicator: adSettings.ShowAdIndicator,
		}
	}
	if termsVersion != nil {
		monetization.AcceptedLiveAdTermsVersion = *termsVersion
	}
	if sponsorshipLine != nil {
		monetization.SponsorshipLine = *sponsorshipLine
	}
	return monetization
}

func (controller SessionsController) GetLiveSafety(writer http.ResponseWriter, request *http.Request) {
	liveId, err := utils.PathIdentifier(request, "liveId")
	if err == nil {
		actor, _ := utils.ActorFrom(request)
		var view *types.LiveSafetyView
		if view, err = services.NewLiveService(controller.Container).GetLiveSafety(request.Context(), liveId, actor.UserId); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"safety": view})
			return
		}
	}
	controller.responder().Error(writer, request, err)
}
