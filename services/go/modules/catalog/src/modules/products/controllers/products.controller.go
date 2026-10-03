package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/middlewares"
	setproductreaction "zudomart/modules/catalog/src/modules/products/commands/setProductReaction"
	getmarthome "zudomart/modules/catalog/src/modules/products/queries/getMartHome"
	getproductdetail "zudomart/modules/catalog/src/modules/products/queries/getProductDetail"
	listproducts "zudomart/modules/catalog/src/modules/products/queries/listProducts"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type ProductsController struct {
	Container *container.Container
}

func (controller ProductsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
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

func (controller ProductsController) GetMartHome(writer http.ResponseWriter, request *http.Request) {
	home, err := (getmarthome.Handler{Container: controller.Container}).Execute(request.Context(), getmarthome.Query{})
	controller.respond(writer, request, http.StatusOK, home, err)
}

func (controller ProductsController) listing(featured bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		category, categoryError := utils.OptionalQueryIdentifier(request, "categoryId")
		store, storeError := utils.OptionalQueryIdentifier(request, "storeId")
		limit, limitError := utils.ReadPageLimit(request, 20, 50)
		for _, failure := range []error{storeError, limitError} {
			if categoryError == nil {
				categoryError = failure
			}
		}
		if categoryError != nil {
			controller.respond(writer, request, 0, nil, categoryError)
			return
		}
		query := request.URL.Query()
		page, err := (listproducts.Handler{Container: controller.Container}).Execute(request.Context(), listproducts.Query{
			Viewer: viewerOf(request), CategoryId: category, StoreId: store, Collection: query.Get("collection"), Text: query.Get("q"),
			Featured: featured || query.Get("collection") == "featured_brands" || query.Get("collection") == "sales_of_the_day", Cursor: query.Get("cursor"), Limit: limit,
		})
		controller.respond(writer, request, http.StatusOK, page, err)
	}
}

func (controller ProductsController) ListProducts(writer http.ResponseWriter, request *http.Request) {
	controller.listing(false)(writer, request)
}

func (controller ProductsController) ListFeaturedProducts(writer http.ResponseWriter, request *http.Request) {
	controller.listing(true)(writer, request)
}

func (controller ProductsController) ListStoreProducts(writer http.ResponseWriter, request *http.Request) {
	storeId, err := utils.PathIdentifier(request, "storeId")
	limit, limitError := utils.ReadPageLimit(request, 20, 50)
	if err == nil {
		err = limitError
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	page, err := (listproducts.Handler{Container: controller.Container}).Execute(request.Context(), listproducts.Query{
		Viewer: viewerOf(request), StoreId: &storeId, Cursor: request.URL.Query().Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller ProductsController) GetProduct(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (getproductdetail.Handler{Container: controller.Container}).Execute(request.Context(), getproductdetail.Query{Viewer: viewerOf(request), ProductId: productId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller ProductsController) react(kind string, active bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		productId, err := utils.PathIdentifier(request, "productId")
		if err == nil {
			err = (setproductreaction.Handler{Container: controller.Container}).Execute(request.Context(),
				setproductreaction.Command{AccountId: middlewares.AccountIdFrom(request.Context()), ProductId: productId, Kind: kind, Active: active})
		}
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		httpserver.WriteNoContentResponse(writer)
	}
}

func (controller ProductsController) LikeProduct(writer http.ResponseWriter, request *http.Request) {
	controller.react(enums.ReactionLike, true)(writer, request)
}

func (controller ProductsController) UnlikeProduct(writer http.ResponseWriter, request *http.Request) {
	controller.react(enums.ReactionLike, false)(writer, request)
}

func (controller ProductsController) BookmarkProduct(writer http.ResponseWriter, request *http.Request) {
	controller.react(enums.ReactionBookmark, true)(writer, request)
}

func (controller ProductsController) UnbookmarkProduct(writer http.ResponseWriter, request *http.Request) {
	controller.react(enums.ReactionBookmark, false)(writer, request)
}
