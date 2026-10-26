package controllers

import (
	"net/http"

	"nantty/modules/ads/src/container"
	allocatepremiumpool "nantty/modules/ads/src/modules/adPolicies/commands/allocatePremiumPool"
	upsertfrequencypolicy "nantty/modules/ads/src/modules/adPolicies/commands/upsertFrequencyPolicy"
	"nantty/modules/ads/src/modules/adPolicies/dtos"
	listadpolicies "nantty/modules/ads/src/modules/adPolicies/queries/listAdPolicies"
	"nantty/modules/ads/src/utils"
	"nantty/platform/httpserver"
)

type AdPoliciesController struct{ Container *container.Container }

func (controller AdPoliciesController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller AdPoliciesController) List(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		policies, err := (listadpolicies.Handler{Container: controller.Container}).Execute(request.Context(), listadpolicies.Query{})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, policies)
		return nil
	})
}

func (controller AdPoliciesController) UpsertFrequency(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		var body dtos.FrequencyPolicy
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		body.Format = request.PathValue("format")
		command := upsertfrequencypolicy.Command{Policy: body}
		if err := command.Validate(); err != nil {
			return err
		}
		if err := (upsertfrequencypolicy.Handler{Container: controller.Container}).Execute(request.Context(), command); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (controller AdPoliciesController) AllocatePremiumPool(writer http.ResponseWriter, request *http.Request) {
	controller.responder().Run(writer, request, func() error {
		var body dtos.PremiumPoolRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		command := allocatepremiumpool.Command{Request: body}
		if err := command.Validate(); err != nil {
			return err
		}
		result, err := (allocatepremiumpool.Handler{Container: controller.Container}).Execute(request.Context(), command)
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}
