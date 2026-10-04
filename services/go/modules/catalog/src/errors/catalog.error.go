package errors

import (
	"net/http"

	"zudomart/platform/httpserver"
)

func Api(status int, code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(status, code, message)
}

var (
	ProductLimitReached    = Api(http.StatusConflict, "PRODUCT_LIMIT_REACHED", "Your plan has reached its active product limit.")
	StoreNotFound          = Api(http.StatusNotFound, "STORE_NOT_FOUND", "That store could not be found.")
	StoreAlreadyExists     = Api(http.StatusConflict, "STORE_ALREADY_EXISTS", "That business profile already has a store.")
	BusinessProfileInvalid = Api(http.StatusUnprocessableEntity, "BUSINESS_PROFILE_INVALID", "Choose one of your active business profiles.")
	StoreSlugTaken         = Api(http.StatusConflict, "STORE_SLUG_TAKEN", "That store link is already taken.")
	ProductNotInRegion     = Api(http.StatusNotFound, "PRODUCT_NOT_AVAILABLE_IN_REGION", "This product is not available in your region.")
	ProductNotFound        = Api(http.StatusNotFound, "PRODUCT_NOT_FOUND", "That product could not be found.")
	VariantNotFound        = Api(http.StatusNotFound, "VARIANT_NOT_FOUND", "That variant could not be found.")
	CategoryNotFound       = Api(http.StatusNotFound, "CATEGORY_NOT_FOUND", "That category could not be found.")
	CategoryLimitReached   = Api(http.StatusConflict, "CATEGORY_LIMIT_REACHED", "This store reached the category limit.")
	CategoryExists         = Api(http.StatusConflict, "CATEGORY_EXISTS", "A category with that name already exists.")
	BrandNotFound          = Api(http.StatusUnprocessableEntity, "BRAND_NOT_FOUND", "That brand could not be found.")
	ProductNotActive       = Api(http.StatusConflict, "PRODUCT_NOT_ACTIVE", "Only active products can be published.")
	ProductNeedsImage      = Api(http.StatusConflict, "PRODUCT_NEEDS_IMAGE", "Add at least one image before publishing.")
	VariantHasStock        = Api(http.StatusConflict, "VARIANT_HAS_STOCK", "A variant that still has stock cannot be removed.")
	SkuTaken               = Api(http.StatusConflict, "SKU_TAKEN", "That SKU is already used in this store.")
	BarcodeTaken           = Api(http.StatusConflict, "BARCODE_TAKEN", "That barcode is already used in this store.")
	SupplierNotFound       = Api(http.StatusUnprocessableEntity, "SUPPLIER_NOT_FOUND", "That supplier could not be found.")
	InvalidLocation        = Api(http.StatusBadRequest, "INVALID_LOCATION", "That location does not belong to this store.")
	ReviewNotFound         = Api(http.StatusNotFound, "REVIEW_NOT_FOUND", "That review could not be found.")
	ReviewNeedsPurchase    = Api(http.StatusForbidden, "REVIEW_REQUIRES_PURCHASE", "Only buyers who received this product can review it.")
	AlreadyReviewed        = Api(http.StatusConflict, "ALREADY_REVIEWED", "You already reviewed this.")
	AlreadyReported        = Api(http.StatusConflict, "ALREADY_REPORTED", "That review was already reported.")
	CannotReviewOwnStore   = Api(http.StatusForbidden, "CANNOT_REVIEW_OWN_STORE", "You cannot review your own store.")
)
