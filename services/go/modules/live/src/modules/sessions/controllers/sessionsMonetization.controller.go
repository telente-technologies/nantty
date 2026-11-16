package controllers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/google/uuid"

	pinproducttolive "nantty/modules/live/src/modules/sessions/commands/pinProductToLive"
	unpinproductfromlive "nantty/modules/live/src/modules/sessions/commands/unpinProductFromLive"
	updatelivecoinsupport "nantty/modules/live/src/modules/sessions/commands/updateLiveCoinSupport"
	updatelivemonetization "nantty/modules/live/src/modules/sessions/commands/updateLiveMonetization"
	"nantty/modules/live/src/modules/sessions/dtos"
	listliveproducts "nantty/modules/live/src/modules/sessions/queries/listLiveProducts"
	"nantty/modules/live/src/modules/sessions/validators"
	"nantty/modules/live/src/types"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

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

// UpdateLiveCoinSupport toggles coin support for an ordinary Live session.
// The idempotent middleware protects retries; the command performs the
// host/state check and row-locked update.
func (controller SessionsController) UpdateLiveCoinSupport(writer http.ResponseWriter, request *http.Request) {
	controller.responder().WithActorAndLive(writer, request, func(actor types.Actor, liveId uuid.UUID) error {
		enabled, err := decodeLiveCoinSupportRequest(http.MaxBytesReader(writer, request.Body, 1024))
		if err != nil {
			return err
		}
		result, err := (updatelivecoinsupport.Handler{Container: controller.Container}).Execute(request.Context(), actor.UserId, liveId, enabled)
		if err == nil {
			httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		}
		return err
	})
}

func decodeLiveCoinSupportRequest(reader io.Reader) (bool, error) {
	decoder := json.NewDecoder(reader)
	invalid := func() (bool, error) {
		return false, httpserver.NewApiError(http.StatusBadRequest, "INVALID_COIN_SUPPORT_REQUEST", "Send exactly one JSON field: enabled (boolean).")
	}
	opening, err := decoder.Token()
	if err != nil || opening != json.Delim('{') {
		return invalid()
	}
	seenEnabled := false
	var enabled bool
	for decoder.More() {
		keyToken, err := decoder.Token()
		key, ok := keyToken.(string)
		if err != nil || !ok || key != "enabled" || seenEnabled {
			return invalid()
		}
		seenEnabled = true
		var rawEnabled json.RawMessage
		if err := decoder.Decode(&rawEnabled); err != nil {
			return invalid()
		}
		switch string(rawEnabled) {
		case "true":
			enabled = true
		case "false":
			enabled = false
		default:
			return invalid()
		}
	}
	closing, err := decoder.Token()
	if err != nil || closing != json.Delim('}') || !seenEnabled {
		return invalid()
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return invalid()
	}
	return enabled, nil
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
