package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	createbrand "zudomart/modules/catalog/src/modules/brands/commands/createBrand"
	getbrand "zudomart/modules/catalog/src/modules/brands/queries/getBrand"
	listbrandproducts "zudomart/modules/catalog/src/modules/brands/queries/listBrandProducts"
	listbrands "zudomart/modules/catalog/src/modules/brands/queries/listBrands"
	"zudomart/modules/catalog/src/modules/brands/validators"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type BrandsController struct {
	Container *container.Container
}

func (controller BrandsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func viewerOf(request *http.Request) *uuid.UUID {
	if _, found := jwtauth.PrincipalFromContext(request.Context()); !found {
		return nil
	}
	identifier := middlewares.AccountIdFrom(request.Context())
	return &identifier
}

func (controller BrandsController) ListBrands(writer http.ResponseWriter, request *http.Request) {
	page, err := (listbrands.Handler{Container: controller.Container}).Execute(request.Context(), listbrands.Query{Text: request.URL.Query().Get("q")})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller BrandsController) GetBrand(writer http.ResponseWriter, request *http.Request) {
	brandId, err := utils.PathIdentifier(request, "brandId")
	var result any
	if err == nil {
		result, err = (getbrand.Handler{Container: controller.Container}).Execute(request.Context(), getbrand.Query{BrandId: brandId, Viewer: viewerOf(request)})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller BrandsController) ListBrandProducts(writer http.ResponseWriter, request *http.Request) {
	brandId, err := utils.PathIdentifier(request, "brandId")
	var result any
	if err == nil {
		result, err = (listbrandproducts.Handler{Container: controller.Container}).Execute(request.Context(), listbrandproducts.Query{BrandId: brandId, Viewer: viewerOf(request)})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller BrandsController) CreateBrand(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateCreateBrand)
	var result any
	if err == nil {
		result, err = (createbrand.Handler{Container: controller.Container}).Execute(request.Context(), createbrand.Command{
			AccountId: middlewares.AccountIdFrom(request.Context()), IdempotencyKey: request.Header.Get("Idempotency-Key"), Request: body,
		})
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}
