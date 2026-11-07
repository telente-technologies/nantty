package controllers

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	recordproductinteractions "nantty/modules/catalog/src/modules/interactions/commands/recordProductInteractions"
	"nantty/modules/catalog/src/modules/interactions/dtos"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type InteractionsController struct {
	Container *container.Container
}

func (controller InteractionsController) RecordInteractions(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	body, err := utils.DecodeAndValidate(writer, request, func(batch dtos.InteractionBatchRequest) error {
		var collected utils.Issues
		collected.CheckRange("events", len(batch.Events), 1, 50)
		return collected.AsError()
	})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	actor, consent := services.InteractionActor{}, services.ConsentChoices{
		Analytics: request.Header.Get("X-Consent-Analytics") == "true", Personalization: request.Header.Get("X-Consent-Personalization") == "true",
	}
	if principal, signedIn := jwtauth.PrincipalFromContext(request.Context()); signedIn {
		actor = services.InteractionActor{
			AccountId: principal.UserId, SessionId: principal.SessionId,
			IdHashSecret:    controller.Container.Settings.IntelligenceIdHashKey,
			IntelligenceKey: controller.Container.Settings.IntelligenceSecret,
		}
		choices, found, lookupError := controller.Container.Users.PrivacyChoicesOf(request.Context(), middlewares.AccountIdFrom(request.Context()))
		if lookupError != nil {
			responder.Error(writer, request, lookupError)
			return
		}
		consent = services.ConsentChoices{Analytics: found && choices.Analytics, Personalization: found && choices.Personalization}
	}
	result, err := (recordproductinteractions.Handler{Container: controller.Container}).Execute(request.Context(),
		recordproductinteractions.Command{Actor: actor, Consent: consent, Events: body.Events})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, result)
}
