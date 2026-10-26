package controllers

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	createcategory "nantty/modules/catalog/src/modules/adminCategories/commands/createCategory"
	movecategory "nantty/modules/catalog/src/modules/adminCategories/commands/moveCategory"
	setcategoryactive "nantty/modules/catalog/src/modules/adminCategories/commands/setCategoryActive"
	updatecategory "nantty/modules/catalog/src/modules/adminCategories/commands/updateCategory"
	"nantty/modules/catalog/src/modules/adminCategories/dtos"
	getcategory "nantty/modules/catalog/src/modules/adminCategories/queries/getCategory"
	listcategories "nantty/modules/catalog/src/modules/adminCategories/queries/listCategories"
	"nantty/modules/catalog/src/modules/adminCategories/validators"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

type AdminCategoriesController struct {
	Container *container.Container
}

func (controller AdminCategoriesController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller AdminCategoriesController) List(writer http.ResponseWriter, request *http.Request) {
	result, err := (listcategories.Handler{Container: controller.Container}).Execute(request.Context(), listcategories.Query{})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AdminCategoriesController) Get(writer http.ResponseWriter, request *http.Request) {
	categoryId, err := utils.PathIdentifier(request, "categoryId")
	var result any
	if err == nil {
		result, err = (getcategory.Handler{Container: controller.Container}).Execute(request.Context(), getcategory.Query{CategoryId: categoryId})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AdminCategoriesController) Create(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, validators.ValidateCreateCategory)
	var result any
	if err == nil {
		result, err = (createcategory.Handler{Container: controller.Container}).Execute(request.Context(), createcategory.Command{Actor: services.StaffActorFrom(request), Request: body})
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller AdminCategoriesController) Update(writer http.ResponseWriter, request *http.Request) {
	categoryId, err := utils.PathIdentifier(request, "categoryId")
	var body dtos.UpdateCategoryRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, validators.ValidateUpdateCategory)
	}
	var result any
	if err == nil {
		result, err = (updatecategory.Handler{Container: controller.Container}).Execute(request.Context(), updatecategory.Command{Actor: services.StaffActorFrom(request), CategoryId: categoryId, Request: body})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AdminCategoriesController) Move(writer http.ResponseWriter, request *http.Request) {
	categoryId, err := utils.PathIdentifier(request, "categoryId")
	var body dtos.MoveRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, validators.ValidateMove)
	}
	var result any
	if err == nil {
		result, err = (movecategory.Handler{Container: controller.Container}).Execute(request.Context(), movecategory.Command{Actor: services.StaffActorFrom(request), CategoryId: categoryId, Direction: body.Direction})
	}
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AdminCategoriesController) setActive(active bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		categoryId, err := utils.PathIdentifier(request, "categoryId")
		var body dtos.ReasonRequest
		if err == nil {
			body, err = utils.DecodeAndValidate(writer, request, validators.ValidateReason)
		}
		var result any
		if err == nil {
			result, err = (setcategoryactive.Handler{Container: controller.Container}).Execute(request.Context(), setcategoryactive.Command{
				Actor: services.StaffActorFrom(request), CategoryId: categoryId, Active: active, Reason: body.Reason,
			})
		}
		controller.respond(writer, request, http.StatusOK, result, err)
	}
}

func (controller AdminCategoriesController) Activate(writer http.ResponseWriter, request *http.Request) {
	controller.setActive(true)(writer, request)
}

func (controller AdminCategoriesController) Deactivate(writer http.ResponseWriter, request *http.Request) {
	controller.setActive(false)(writer, request)
}
