package controllers

import (
	"net/http"
	"strconv"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	archiveproduct "zudomart/modules/catalog/src/modules/sellerProducts/commands/archiveProduct"
	bulkproductaction "zudomart/modules/catalog/src/modules/sellerProducts/commands/bulkProductAction"
	createproduct "zudomart/modules/catalog/src/modules/sellerProducts/commands/createProduct"
	duplicateproduct "zudomart/modules/catalog/src/modules/sellerProducts/commands/duplicateProduct"
	replaceproduct "zudomart/modules/catalog/src/modules/sellerProducts/commands/replaceProduct"
	setproductpublication "zudomart/modules/catalog/src/modules/sellerProducts/commands/setProductPublication"
	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
	exportproductscsv "zudomart/modules/catalog/src/modules/sellerProducts/queries/exportProductsCsv"
	generatebarcodes "zudomart/modules/catalog/src/modules/sellerProducts/queries/generateBarcodes"
	getproductusage "zudomart/modules/catalog/src/modules/sellerProducts/queries/getProductUsage"
	getsellerproduct "zudomart/modules/catalog/src/modules/sellerProducts/queries/getSellerProduct"
	listsellerproducts "zudomart/modules/catalog/src/modules/sellerProducts/queries/listSellerProducts"
	"zudomart/modules/catalog/src/modules/sellerProducts/validators"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type SellerProductsController struct {
	Container *container.Container
}

func (controller SellerProductsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func (controller SellerProductsController) ListProducts(writer http.ResponseWriter, request *http.Request) {
	category, categoryError := utils.OptionalQueryIdentifier(request, "categoryId")
	variant, variantError := utils.OptionalQueryIdentifier(request, "variantId")
	supplier, supplierError := utils.OptionalQueryIdentifier(request, "supplierId")
	location, locationError := utils.OptionalQueryIdentifier(request, "locationId")
	limit, limitError := utils.ReadPageLimit(request, 25, 200)
	stock := request.URL.Query().Get("stock")
	var stockError error
	if stock != "" && stock != "low" && stock != "out" && stock != "all" {
		stockError = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "stock", Message: "must be low, out or all"}})
	}
	if stock == "all" {
		stock = ""
	}
	for _, failure := range []error{variantError, supplierError, locationError, limitError, stockError} {
		if categoryError == nil {
			categoryError = failure
		}
	}
	if categoryError != nil {
		controller.respond(writer, request, 0, nil, categoryError)
		return
	}
	query := request.URL.Query()
	page, err := (listsellerproducts.Handler{Container: controller.Container}).Execute(request.Context(), listsellerproducts.Query{
		StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Text: query.Get("q"), CategoryId: category, VariantId: variant, Status: query.Get("status"),
		Online: query.Get("online"), Visibility: query.Get("visibility"), SupplierId: supplier, Stock: stock, LocationId: location, Sort: query.Get("sort"), Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller SellerProductsController) CreateProduct(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ProductUpsertRequest](writer, request, validators.ValidateProductUpsert)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (createproduct.Handler{Container: controller.Container}).Execute(request.Context(),
		createproduct.Command{Store: middlewares.StoreAccessFrom(request.Context()), ActorId: middlewares.AccountIdFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller SellerProductsController) GetProduct(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (getsellerproduct.Handler{Container: controller.Container}).Execute(request.Context(),
		getsellerproduct.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, ProductId: productId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerProductsController) ReplaceProduct(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	body, err := utils.DecodeAndValidate[dtos.ProductUpsertRequest](writer, request, validators.ValidateProductUpsert)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (replaceproduct.Handler{Container: controller.Container}).Execute(request.Context(), replaceproduct.Command{
		Store: middlewares.StoreAccessFrom(request.Context()), ActorId: middlewares.AccountIdFrom(request.Context()), ProductId: productId, Request: body,
	})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerProductsController) ArchiveProduct(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (archiveproduct.Handler{Container: controller.Container}).Execute(request.Context(),
		archiveproduct.Command{Store: middlewares.StoreAccessFrom(request.Context()), ProductId: productId})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller SellerProductsController) setPublication(publish bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		productId, err := utils.PathIdentifier(request, "productId")
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		view, err := (setproductpublication.Handler{Container: controller.Container}).Execute(request.Context(),
			setproductpublication.Command{Store: middlewares.StoreAccessFrom(request.Context()), ProductId: productId, Publish: publish})
		controller.respond(writer, request, http.StatusOK, view, err)
	}
}

func (controller SellerProductsController) GetUsage(writer http.ResponseWriter, request *http.Request) {
	usage, err := (getproductusage.Handler{Container: controller.Container}).Execute(request.Context(),
		getproductusage.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, OwnerAccountId: middlewares.StoreAccessFrom(request.Context()).OwnerAccountId})
	controller.respond(writer, request, http.StatusOK, usage, err)
}

func (controller SellerProductsController) BulkAction(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.BulkActionRequest](writer, request, validators.ValidateBulkAction)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := (bulkproductaction.Handler{Container: controller.Container}).Execute(request.Context(),
		bulkproductaction.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller SellerProductsController) DuplicateProduct(writer http.ResponseWriter, request *http.Request) {
	productId, err := utils.PathIdentifier(request, "productId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (duplicateproduct.Handler{Container: controller.Container}).Execute(request.Context(),
		duplicateproduct.Command{Store: middlewares.StoreAccessFrom(request.Context()), ActorId: middlewares.AccountIdFrom(request.Context()), ProductId: productId})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller SellerProductsController) GenerateBarcodes(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.BarcodeRequest](writer, request, validators.ValidateBarcodeRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	barcodes, err := (generatebarcodes.Handler{Container: controller.Container}).Execute(request.Context(),
		generatebarcodes.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Count: body.Count})
	controller.respond(writer, request, http.StatusOK, map[string][]string{"barcodes": barcodes}, err)
}

func (controller SellerProductsController) ExportProducts(writer http.ResponseWriter, request *http.Request) {
	location, err := utils.OptionalQueryIdentifier(request, "locationId")
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	content, err := (exportproductscsv.Handler{Container: controller.Container}).Execute(request.Context(),
		exportproductscsv.Query{StoreId: store.StoreId, Currency: string(store.Currency), LocationId: location})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	writer.Header().Set("Content-Disposition", `attachment; filename="products.csv"`)
	writer.Header().Set("Content-Length", strconv.Itoa(len(content)))
	_, _ = writer.Write(content)
}

func (controller SellerProductsController) PublishProduct(writer http.ResponseWriter, request *http.Request) {
	controller.setPublication(true)(writer, request)
}

func (controller SellerProductsController) UnpublishProduct(writer http.ResponseWriter, request *http.Request) {
	controller.setPublication(false)(writer, request)
}
