package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	createbrand "nantty/modules/catalog/src/modules/brands/commands/createBrand"
	createbrandstorefront "nantty/modules/catalog/src/modules/brands/commands/createBrandStorefront"
	setbrandselling "nantty/modules/catalog/src/modules/brands/commands/setBrandSelling"
	"nantty/modules/catalog/src/modules/brands/dtos"
	getbrand "nantty/modules/catalog/src/modules/brands/queries/getBrand"
	listbrandproducts "nantty/modules/catalog/src/modules/brands/queries/listBrandProducts"
	listbrands "nantty/modules/catalog/src/modules/brands/queries/listBrands"
	"nantty/modules/catalog/src/modules/brands/validators"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
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

func (controller BrandsController) UpdateBrand(writer http.ResponseWriter, request *http.Request) {
	brandId, err := utils.PathIdentifier(request, "brandId")
	var result any
	if err == nil {
		var body dtos.UpdateBrandRequest
		if body, err = utils.DecodeAndValidate(writer, request, validators.ValidateUpdateBrand); err == nil {
			result, err = (setbrandselling.Handler{Container: controller.Container}).Execute(request.Context(), setbrandselling.Command{
				AccountId: middlewares.AccountIdFrom(request.Context()), BrandId: brandId, SellingEnabled: *body.SellingEnabled,
			})
		}
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller BrandsController) CreateStorefront(writer http.ResponseWriter, request *http.Request) {
	brandId, err := utils.PathIdentifier(request, "brandId")
	var result any
	if err == nil {
		var body dtos.CreateStorefrontRequest
		if body, err = utils.DecodeAndValidate(writer, request, validators.ValidateCreateStorefront); err == nil {
			result, err = (createbrandstorefront.Handler{Container: controller.Container}).Execute(request.Context(), createbrandstorefront.Command{
				AccountId: middlewares.AccountIdFrom(request.Context()), BrandId: brandId, CountryCode: body.CountryCode,
			})
		}
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}
