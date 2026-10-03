package controllers

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	createstorecategory "zudomart/modules/catalog/src/modules/categories/commands/createStoreCategory"
	deletestorecategory "zudomart/modules/catalog/src/modules/categories/commands/deleteStoreCategory"
	updatestorecategory "zudomart/modules/catalog/src/modules/categories/commands/updateStoreCategory"
	"zudomart/modules/catalog/src/modules/categories/dtos"
	listplatformcategories "zudomart/modules/catalog/src/modules/categories/queries/listPlatformCategories"
	liststorecategories "zudomart/modules/catalog/src/modules/categories/queries/listStoreCategories"
	"zudomart/modules/catalog/src/modules/categories/validators"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type CategoriesController struct {
	Container *container.Container
}

func (controller CategoriesController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller CategoriesController) ListPlatformCategories(writer http.ResponseWriter, request *http.Request) {
	page, err := (listplatformcategories.Handler{Container: controller.Container}).Execute(request.Context(), listplatformcategories.Query{})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller CategoriesController) ListStoreCategories(writer http.ResponseWriter, request *http.Request) {
	page, err := (liststorecategories.Handler{Container: controller.Container}).Execute(request.Context(),
		liststorecategories.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller CategoriesController) CreateStoreCategory(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.CategoryRequest](writer, request, validators.ValidateCategory)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (createstorecategory.Handler{Container: controller.Container}).Execute(request.Context(),
		createstorecategory.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller CategoriesController) UpdateStoreCategory(writer http.ResponseWriter, request *http.Request) {
	categoryId, err := utils.PathIdentifier(request, "categoryId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	body, err := utils.DecodeAndValidate[dtos.CategoryRequest](writer, request, validators.ValidateCategory)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (updatestorecategory.Handler{Container: controller.Container}).Execute(request.Context(),
		updatestorecategory.Command{Store: middlewares.StoreAccessFrom(request.Context()), CategoryId: categoryId, Request: body})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller CategoriesController) DeleteStoreCategory(writer http.ResponseWriter, request *http.Request) {
	categoryId, err := utils.PathIdentifier(request, "categoryId")
	if err == nil {
		err = (deletestorecategory.Handler{Container: controller.Container}).Execute(request.Context(),
			deletestorecategory.Command{Store: middlewares.StoreAccessFrom(request.Context()), CategoryId: categoryId})
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
