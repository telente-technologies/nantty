package errors

import (
	"net/http"

	"nantty/platform/httpserver"
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

var StoreFollowStatsUnavailable = Api(http.StatusServiceUnavailable, "STORE_FOLLOW_STATS_UNAVAILABLE", "Store follow information is temporarily unavailable. Try again shortly.")
var StoreFollowUnavailable = Api(http.StatusServiceUnavailable, "STORE_FOLLOW_UNAVAILABLE", "Store follow could not be updated right now. Try again shortly.")

var (
	StaffNotFound       = Api(http.StatusNotFound, "STAFF_NOT_FOUND", "That team member could not be found.")
	StaffExists         = Api(http.StatusConflict, "STAFF_EXISTS", "That person is already on this team.")
	SeatLimitReached    = Api(http.StatusConflict, "SEAT_LIMIT_REACHED", "Your plan has no free team seats. Upgrade or remove someone first.")
	OwnerRoleReserved   = Api(http.StatusForbidden, "OWNER_ROLE_RESERVED", "The owner role cannot be given to someone else.")
	OwnerOnly           = Api(http.StatusForbidden, "OWNER_ONLY", "Only the store owner can do that.")
	OwnerProtected      = Api(http.StatusForbidden, "OWNER_PROTECTED", "The store owner cannot be changed or removed.")
	CannotEditSelf      = Api(http.StatusForbidden, "CANNOT_EDIT_SELF", "You cannot change your own access.")
	CannotRemoveSelf    = Api(http.StatusForbidden, "CANNOT_REMOVE_SELF", "You cannot remove yourself from the team.")
	TeamRequestNotFound = Api(http.StatusNotFound, "TEAM_REQUEST_NOT_FOUND", "That team request could not be found.")
)

var (
	NotFound                = Api(http.StatusNotFound, "NOT_FOUND", "That item could not be found.")
	SlugTaken               = Api(http.StatusConflict, "SLUG_TAKEN", "Another item already uses this slug.")
	CannotMove              = Api(http.StatusConflict, "CANNOT_MOVE", "This item cannot move further in that direction.")
	NoChange                = Api(http.StatusConflict, "NO_CHANGE", "Nothing changed.")
	AlreadyDecided          = Api(http.StatusConflict, "ALREADY_DECIDED", "This application was already decided.")
	ApplicationPending      = Api(http.StatusConflict, "APPLICATION_PENDING", "You already have an application waiting for review.")
	AlreadySeller           = Api(http.StatusConflict, "ALREADY_SELLER", "Your seller application was already approved.")
	SellerMarketUnavailable = Api(http.StatusForbidden, "SELLER_MARKET_UNAVAILABLE", "Seller registration is currently available in Nigeria only. Creators outside Nigeria may still apply to the Creator Program.")
	InvalidOfficialStatus   = Api(http.StatusConflict, "INVALID_OFFICIAL_STATUS_TRANSITION", "That change is not allowed from the brand's current Official Store status.")
	BrandHandleTaken        = Api(http.StatusConflict, "HANDLE_TAKEN", "That brand handle is already taken.")
	CannotFollowOwn         = Api(http.StatusConflict, "CANNOT_FOLLOW_OWN", "You cannot follow your own store or brand.")
	ReviewNotYours          = Api(http.StatusNotFound, "REVIEW_NOT_FOUND", "That review could not be found.")
)

var (
	ProfileLimitStoreOrBusiness = Api(http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS", "You can have one Store or one Business page, not both.")
	StoreLimitOne               = Api(http.StatusConflict, "STORE_LIMIT_ONE", "You can own one store. Your other business profiles can be brands that don't sell.")
	BusinessProfileLimit        = Api(http.StatusConflict, "BUSINESS_PROFILE_LIMIT", "You can have up to 5 business profiles with Premium.")
	ProfileLimitOneBrand        = Api(http.StatusConflict, "PROFILE_LIMIT_ONE_BRAND", "You can have one Brand.")
	ProfileOnHold               = Api(http.StatusConflict, "PROFILE_ON_HOLD", "Choose which profiles to keep before adding listings here.")
	BrandSellingOff             = Api(http.StatusConflict, "BRAND_SELLING_OFF", "Turn on selling for this brand before adding listings.")
	BrandNotOwned               = Api(http.StatusForbidden, "OWNER_ONLY", "Only the brand owner can do that.")
	BrandStorefrontExists       = Api(http.StatusConflict, "BRAND_STOREFRONT_EXISTS", "This brand already has a storefront.")
)

func ProfileLimitFor(code string) error {
	switch code {
	case ProfileLimitOneBrand.Code:
		return ProfileLimitOneBrand
	case ProfileOnHold.Code:
		return ProfileOnHold
	case StoreLimitOne.Code:
		return StoreLimitOne
	case BusinessProfileLimit.Code:
		return BusinessProfileLimit
	case "NO_CHANGE":
		return NoChange
	}
	return ProfileLimitStoreOrBusiness
}
