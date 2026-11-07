package controllers

import (
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/middlewares"
	setproductreaction "nantty/modules/catalog/src/modules/products/commands/setProductReaction"
	getmarthome "nantty/modules/catalog/src/modules/products/queries/getMartHome"
	getproductdetail "nantty/modules/catalog/src/modules/products/queries/getProductDetail"
	getrecommendedproducts "nantty/modules/catalog/src/modules/products/queries/getRecommendedProducts"
	listproducts "nantty/modules/catalog/src/modules/products/queries/listProducts"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
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

func (controller ProductsController) GetRecommendedProducts(writer http.ResponseWriter, request *http.Request) {
	products, err := (getrecommendedproducts.Handler{Container: controller.Container}).Execute(request.Context(), viewerOf(request))
	controller.respond(writer, request, http.StatusOK, products, err)
}

func (controller ProductsController) listing(featured bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		category, categoryError := utils.OptionalQueryIdentifier(request, "categoryId")
		store, storeError := utils.OptionalQueryIdentifier(request, "storeId")
		limit, limitError := utils.ReadPageLimit(request, 20, 50)
		filters, filterError := readListingFilters(request)
		for _, failure := range []error{storeError, limitError, filterError} {
			if categoryError == nil {
				categoryError = failure
			}
		}
		if categoryError != nil {
			controller.respond(writer, request, 0, nil, categoryError)
			return
		}
		query := request.URL.Query()
		filters.Viewer, filters.CategoryId, filters.StoreId, filters.Collection, filters.Text = viewerOf(request), category, store, query.Get("collection"), query.Get("q")
		filters.Featured = featured || query.Get("collection") == "featured_brands" || query.Get("collection") == "sales_of_the_day"
		filters.Cursor, filters.Limit = query.Get("cursor"), limit
		page, err := (listproducts.Handler{Container: controller.Container}).Execute(request.Context(), filters)
		controller.respond(writer, request, http.StatusOK, page, err)
	}
}

func readListingFilters(request *http.Request) (listproducts.Query, error) {
	query := request.URL.Query()
	issues := utils.Issues{}
	filters := listproducts.Query{Sort: query.Get("sort"), CategorySlug: query.Get("categorySlug"), Currency: strings.ToUpper(query.Get("currency"))}
	if filters.Sort != "" && !slices.Contains(listproducts.Sorts, filters.Sort) {
		issues.Add("sort", "must be one of "+strings.Join(listproducts.Sorts, ", "))
	}
	for _, bound := range []struct {
		name   string
		target **int64
	}{{"minPrice", &filters.MinPrice}, {"maxPrice", &filters.MaxPrice}} {
		if raw := query.Get(bound.name); raw != "" {
			value, err := strconv.ParseInt(raw, 10, 64)
			if err != nil || value < 0 {
				issues.Add(bound.name, "must be a whole amount in minor units")
				continue
			}
			*bound.target = &value
		}
	}
	if (filters.MinPrice != nil || filters.MaxPrice != nil) && len(filters.Currency) != 3 {
		issues.Add("currency", "is required with minPrice or maxPrice")
	}
	if filters.MinPrice != nil && filters.MaxPrice != nil && *filters.MinPrice > *filters.MaxPrice {
		issues.Add("maxPrice", "must not be below minPrice")
	}
	return filters, issues.AsError()
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
