package controllers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	deleteshippingrule "zudomart/modules/orders/src/modules/shipping/commands/deleteShippingRule"
	saveshippingrule "zudomart/modules/orders/src/modules/shipping/commands/saveShippingRule"
	setfreeshippingthreshold "zudomart/modules/orders/src/modules/shipping/commands/setFreeShippingThreshold"
	"zudomart/modules/orders/src/modules/shipping/dtos"
	getshippingprofile "zudomart/modules/orders/src/modules/shipping/queries/getShippingProfile"
	listshippingprofiles "zudomart/modules/orders/src/modules/shipping/queries/listShippingProfiles"
	previewshipping "zudomart/modules/orders/src/modules/shipping/queries/previewShipping"
	"zudomart/modules/orders/src/modules/shipping/validators"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type ShippingController struct {
	Container *container.Container
}

func (controller ShippingController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller ShippingController) GetProfile(writer http.ResponseWriter, request *http.Request) {
	view, err := (getshippingprofile.Handler{Container: controller.Container}).Execute(request.Context(), getshippingprofile.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller ShippingController) ListProfiles(writer http.ResponseWriter, request *http.Request) {
	page, err := (listshippingprofiles.Handler{Container: controller.Container}).Execute(request.Context(), listshippingprofiles.Query{Store: middlewares.StoreAccessFrom(request.Context())})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller ShippingController) PatchProfile(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ProfilePatchRequest](writer, request, validators.ValidateProfilePatch)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	var threshold *int64
	if body.FreeShippingThresholdMinor != nil {
		threshold = *body.FreeShippingThresholdMinor
	}
	view, err := (setfreeshippingthreshold.Handler{Container: controller.Container}).Execute(request.Context(),
		setfreeshippingthreshold.Command{Store: middlewares.StoreAccessFrom(request.Context()), ThresholdMinor: threshold})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func toRuleInput(body dtos.RuleRequest) services.RuleInput {
	input := services.RuleInput{ZoneName: body.ZoneName, FeeMinor: body.FeeMinor, Active: body.Active}
	if body.Type != nil {
		free := *body.Type == "free"
		input.IsFree = &free
	}
	if body.Destinations != nil {
		destinations := make([]services.DestinationInput, 0, len(*body.Destinations))
		for _, destination := range *body.Destinations {
			item := services.DestinationInput{CountryCode: destination.CountryCode, StateCode: destination.StateCode, LgaName: destination.LgaName}
			if destination.RegionId != nil {
				identifier := uuid.MustParse(*destination.RegionId)
				item.RegionId = &identifier
			}
			if destination.AdminAreaId != nil {
				identifier := uuid.MustParse(*destination.AdminAreaId)
				item.AdminAreaId = &identifier
			}
			destinations = append(destinations, item)
		}
		input.Destinations = &destinations
	}
	return input
}

func (controller ShippingController) CreateRule(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.RuleRequest](writer, request, validators.ValidateCreateRule)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := (saveshippingrule.Handler{Container: controller.Container}).Execute(request.Context(),
		saveshippingrule.Command{Store: middlewares.StoreAccessFrom(request.Context()), Input: toRuleInput(body)})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller ShippingController) UpdateRule(writer http.ResponseWriter, request *http.Request) {
	ruleId, err := utils.PathIdentifier(request, "ruleId")
	var body dtos.RuleRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.RuleRequest](writer, request, validators.ValidateUpdateRule)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := (saveshippingrule.Handler{Container: controller.Container}).Execute(request.Context(),
		saveshippingrule.Command{Store: middlewares.StoreAccessFrom(request.Context()), RuleId: &ruleId, Input: toRuleInput(body)})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller ShippingController) DeleteRule(writer http.ResponseWriter, request *http.Request) {
	ruleId, err := utils.PathIdentifier(request, "ruleId")
	if err == nil {
		err = (deleteshippingrule.Handler{Container: controller.Container}).Execute(request.Context(), deleteshippingrule.Command{Store: middlewares.StoreAccessFrom(request.Context()), RuleId: ruleId})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller ShippingController) Preview(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	total, parseError := strconv.ParseInt(query.Get("orderTotalMinor"), 10, 64)
	var collected utils.Issues
	if query.Get("stateCode") == "" {
		collected.Add("stateCode", "is required")
	}
	if parseError != nil || total < 0 {
		collected.Add("orderTotalMinor", "must be an integer of zero or more")
	}
	if err := collected.AsError(); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (previewshipping.Handler{Container: controller.Container}).Execute(request.Context(), previewshipping.Query{
		Store: middlewares.StoreAccessFrom(request.Context()), StateCode: query.Get("stateCode"), LgaName: query.Get("lgaName"), OrderTotalMinor: total,
	})
	controller.respond(writer, request, http.StatusOK, view, err)
}
