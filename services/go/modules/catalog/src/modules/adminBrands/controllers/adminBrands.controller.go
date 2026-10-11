package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	decideofficialstatus "zudomart/modules/catalog/src/modules/adminBrands/commands/decideOfficialStatus"
	reassignbrand "zudomart/modules/catalog/src/modules/adminBrands/commands/reassignBrand"
	getbrand "zudomart/modules/catalog/src/modules/adminBrands/queries/getBrand"
	listbrands "zudomart/modules/catalog/src/modules/adminBrands/queries/listBrands"
	viewdocument "zudomart/modules/catalog/src/modules/adminBrands/queries/viewDocument"
	"zudomart/modules/catalog/src/modules/brands/dtos"
	"zudomart/modules/catalog/src/modules/brands/validators"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type AdminBrandsController struct {
	Container *container.Container
}

func (controller AdminBrandsController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func (controller AdminBrandsController) List(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 25, 100)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	query := request.URL.Query()
	page, err := (listbrands.Handler{Container: controller.Container}).Execute(request.Context(), listbrands.Query{
		Search: query.Get("search"), Official: query.Get("official"), Country: query.Get("country"), Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, page, err)
}

func (controller AdminBrandsController) Get(writer http.ResponseWriter, request *http.Request) {
	brandId, err := utils.PathIdentifier(request, "brandId")
	var result any
	if err == nil {
		result, err = (getbrand.Handler{Container: controller.Container}).Execute(request.Context(), getbrand.Query{BrandId: brandId})
	}
	controller.respond(writer, request, result, err)
}

func (controller AdminBrandsController) Document(writer http.ResponseWriter, request *http.Request) {
	brandId, err := utils.PathIdentifier(request, "brandId")
	var result any
	if err == nil {
		result, err = (viewdocument.Handler{Container: controller.Container}).Execute(request.Context(), viewdocument.Query{
			Actor: services.StaffActorFrom(request), BrandId: brandId, DocumentId: request.PathValue("documentId"),
		})
	}
	controller.respond(writer, request, result, err)
}

func (controller AdminBrandsController) Decide(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		brandId, err := utils.PathIdentifier(request, "brandId")
		var body dtos.OfficialDecisionRequest
		if err == nil {
			body, err = utils.DecodeAndValidate(writer, request, validators.ValidateDecision)
		}
		var result any
		if err == nil {
			result, err = (decideofficialstatus.Handler{Container: controller.Container}).Execute(request.Context(), decideofficialstatus.Command{
				Actor: services.StaffActorFrom(request), BrandId: brandId, Action: action, Reason: body.Reason,
			})
		}
		controller.respond(writer, request, result, err)
	}
}

func acceptReassign(dtos.ReassignBrandRequest) error { return nil }

func (controller AdminBrandsController) Reassign(writer http.ResponseWriter, request *http.Request) {
	brandId, err := utils.PathIdentifier(request, "brandId")
	var body dtos.ReassignBrandRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, acceptReassign)
	}
	var result any
	if err == nil {
		result, err = (reassignbrand.Handler{Container: controller.Container}).Execute(request.Context(), reassignbrand.Command{
			Actor: services.StaffActorFrom(request), BrandId: brandId, ToAccountId: body.ToAccountId, Reason: body.Reason,
		})
	}
	controller.respond(writer, request, result, err)
}
