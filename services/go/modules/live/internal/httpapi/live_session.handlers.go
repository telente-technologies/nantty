package httpapi

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/application"
	"zudomart/platform/httpserver"
)

func decodeAndValidate[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}

func (routes LiveRoutes) withActorAndLive(writer http.ResponseWriter, request *http.Request, run func(application.Actor, uuid.UUID) error) {
	actor, err := routes.actorFrom(request)
	if err == nil {
		var liveId uuid.UUID
		if liveId, err = pathIdentifier(request, "liveId"); err == nil {
			err = run(actor, liveId)
		}
	}
	if err != nil {
		routes.respondWithError(writer, request, err)
	}
}

func buildMonetization(adSettings *liveAdSettingsRequest, termsVersion, sponsorshipLine *string) application.LiveMonetizationInput {
	monetization := application.LiveMonetizationInput{}
	if adSettings != nil {
		monetization.LiveAdSettings = &application.LiveAdSettingsInput{
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

func (routes LiveRoutes) createLiveSession(writer http.ResponseWriter, request *http.Request) {
	actor, err := routes.actorFrom(request)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	body, err := decodeAndValidate(writer, request, ValidateCreateLiveRequest)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	input := application.CreateLiveSessionInput{
		Title: body.Title, Category: body.Category, Visibility: body.Visibility, StartNow: body.StartNow == nil || *body.StartNow,
		CountryCode: clientRegion(request), Monetization: buildMonetization(body.LiveAdSettings, body.AcceptedLiveAdTermsVersion, body.SponsorshipLine),
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
	view, err := routes.Application.CreateLiveSession(request.Context(), actor, input)
	if err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, view)
}

func (routes LiveRoutes) getLiveSession(writer http.ResponseWriter, request *http.Request) {
	liveId, err := pathIdentifier(request, "liveId")
	if err == nil {
		var view application.LiveSessionView
		if view, err = routes.Application.GetLiveSession(request.Context(), liveId); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
			return
		}
	}
	routes.respondWithError(writer, request, err)
}

func (routes LiveRoutes) listSuggestedLives(writer http.ResponseWriter, request *http.Request) {
	actor, err := routes.actorFrom(request)
	if err == nil {
		var views []application.SuggestedLiveView
		if views, err = routes.Application.ListSuggestedLives(request.Context(), actor.UserId); err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, views)
			return
		}
	}
	routes.respondWithError(writer, request, err)
}

func (routes LiveRoutes) startLiveSession(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		view, err := routes.Application.StartLiveSession(request.Context(), actor, liveId)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (routes LiveRoutes) endLiveSession(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		err := routes.Application.EndLiveSession(request.Context(), actor, liveId)
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (routes LiveRoutes) joinLive(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		err := routes.Application.JoinLiveAsViewer(request.Context(), actor, liveId)
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (routes LiveRoutes) leaveLive(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		err := routes.Application.LeaveLiveAsViewer(request.Context(), actor, liveId)
		if err == nil {
			httpserver.WriteNoContentResponse(writer)
		}
		return err
	})
}

func (routes LiveRoutes) acknowledgeReaction(writer http.ResponseWriter, request *http.Request) {
	if _, err := decodeAndValidate(writer, request, func(reactionRequest) error { return nil }); err != nil {
		routes.respondWithError(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (routes LiveRoutes) shareLive(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		if _, err := decodeAndValidate(writer, request, func(shareRequest) error { return nil }); err != nil {
			return err
		}
		if _, err := routes.Application.AwardEngagementPoints(request.Context(), actor, liveId, "share"); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (routes LiveRoutes) updateLiveMonetization(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, ValidateMonetizationRequest)
		if err != nil {
			return err
		}
		view, err := routes.Application.UpdateLiveMonetization(request.Context(), actor, liveId, buildMonetization(body.LiveAdSettings, body.AcceptedLiveAdTermsVersion, body.SponsorshipLine))
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		}
		return err
	})
}

func (routes LiveRoutes) issueMediaToken(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		token, err := routes.Application.IssueMediaToken(request.Context(), actor, liveId)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, token)
		}
		return err
	})
}

func (routes LiveRoutes) pinProduct(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(actor application.Actor, liveId uuid.UUID) error {
		body, err := decodeAndValidate(writer, request, ValidatePinProductRequest)
		if err != nil {
			return err
		}
		products, err := routes.Application.PinProductToLive(request.Context(), actor, liveId, uuid.MustParse(body.ProductId))
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(products, ""))
		}
		return err
	})
}

func (routes LiveRoutes) listLiveProducts(writer http.ResponseWriter, request *http.Request) {
	routes.withActorAndLive(writer, request, func(_ application.Actor, liveId uuid.UUID) error {
		products, err := routes.Application.ListLiveProducts(request.Context(), liveId)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(products, ""))
		}
		return err
	})
}
