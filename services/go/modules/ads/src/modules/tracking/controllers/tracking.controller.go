package controllers

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	recordadevents "zudomart/modules/ads/src/modules/tracking/commands/recordAdEvents"
	recordconversion "zudomart/modules/ads/src/modules/tracking/commands/recordConversion"
	"zudomart/modules/ads/src/modules/tracking/dtos"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
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
