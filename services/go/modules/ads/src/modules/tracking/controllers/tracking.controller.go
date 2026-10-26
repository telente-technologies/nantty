package controllers

import (
	"net/http"

	"nantty/modules/ads/src/container"
	recordadevents "nantty/modules/ads/src/modules/tracking/commands/recordAdEvents"
	recordconversion "nantty/modules/ads/src/modules/tracking/commands/recordConversion"
	redirectadclick "nantty/modules/ads/src/modules/tracking/commands/redirectAdClick"
	"nantty/modules/ads/src/modules/tracking/dtos"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

type TrackingController struct{ Container *container.Container }

func (controller TrackingController) RecordEvents(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	responder.Run(writer, request, func() error {
		userId, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		var body dtos.RecordAdEventsRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if len(body.Events) == 0 || len(body.Events) > recordadevents.MaximumEventsPerBatch {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "events", Message: "must contain 1-100 events"}})
		}
		response, err := (recordadevents.Handler{Container: controller.Container}).Execute(request.Context(), recordadevents.Command{UserId: userId.String(), UserAgent: request.UserAgent(), Events: body.Events})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, response)
		return nil
	})
}

func (controller TrackingController) RecordConversion(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		var body recordconversion.Command
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := body.Validate(); err != nil {
			return err
		}
		result, err := (recordconversion.Handler{Container: controller.Container}).Execute(request.Context(), body)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]bool{"attributed": result.Attributed})
		return nil
	})
}

func (controller TrackingController) RedirectClick(writer http.ResponseWriter, request *http.Request) {
	target, err := (redirectadclick.Handler{Container: controller.Container}).Execute(request.Context(), redirectadclick.Command{Token: request.PathValue("token"), UserAgent: request.UserAgent(), Platform: request.URL.Query().Get("platform")})
	if err != nil {
		httpserver.WriteJsonResponse(writer, http.StatusNotFound, httpserver.NewApiError(http.StatusNotFound, "AD_LINK_INVALID", "This ad link is no longer valid."))
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(writer, request, target, http.StatusFound)
}
