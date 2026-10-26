package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/sellerProducts/controllers"
)

func MountSellerProductsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerProductsController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "catalog:view", false)
	manager := middlewares.StoreMember(deployed, "products:manage", false)
	seller := middlewares.SellingStoreMember(deployed, "products:manage")
	bulk := middlewares.StoreMemberFeature(deployed, "products:manage", "bulk_tools", false)
	bulkViewer := middlewares.StoreMemberFeature(deployed, "catalog:view", "bulk_tools", false)
	mux.Handle("GET /api/v1/seller/products", viewer(controller.ListProducts))
	mux.Handle("GET /api/v1/seller/products/usage", viewer(controller.GetUsage))
	mux.Handle("GET /api/v1/seller/products/export", bulkViewer(controller.ExportProducts))
	mux.Handle("POST /api/v1/seller/products", seller(controller.CreateProduct))
	mux.Handle("POST /api/v1/seller/products/bulk", bulk(controller.BulkAction))
	mux.Handle("POST /api/v1/seller/products/barcodes", manager(controller.GenerateBarcodes))
	mux.Handle("GET /api/v1/seller/products/{productId}", viewer(controller.GetProduct))
	mux.Handle("PATCH /api/v1/seller/products/{productId}", manager(controller.ReplaceProduct))
	mux.Handle("DELETE /api/v1/seller/products/{productId}", manager(controller.ArchiveProduct))
	mux.Handle("POST /api/v1/seller/products/{productId}/publish", seller(controller.PublishProduct))
	mux.Handle("POST /api/v1/seller/products/{productId}/unpublish", manager(controller.UnpublishProduct))
	mux.Handle("POST /api/v1/seller/products/{productId}/duplicate", seller(controller.DuplicateProduct))
}
