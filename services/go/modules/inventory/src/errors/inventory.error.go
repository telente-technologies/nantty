package errors

import (
	"net/http"

	"nantty/platform/httpserver"
)

func Api(status int, code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(status, code, message)
}

var (
	LocationNotFound        = Api(http.StatusNotFound, "LOCATION_NOT_FOUND", "That location could not be found.")
	LocationLimitReached    = Api(http.StatusConflict, "LOCATION_LIMIT_REACHED", "Your plan has reached its location limit.")
	LocationExists          = Api(http.StatusConflict, "LOCATION_EXISTS", "A location with that name already exists.")
	DefaultLocationRequired = Api(http.StatusConflict, "DEFAULT_LOCATION", "The default location must stay active.")
	VariantNotFound         = Api(http.StatusNotFound, "VARIANT_NOT_FOUND", "That variant could not be found.")
	InsufficientStock       = Api(http.StatusConflict, "INSUFFICIENT_STOCK", "There is not enough stock for that change.")
	SupplierNotFound        = Api(http.StatusNotFound, "SUPPLIER_NOT_FOUND", "That supplier could not be found.")
	TransferNotFound        = Api(http.StatusNotFound, "TRANSFER_NOT_FOUND", "That transfer could not be found.")
	TransferAlreadyFinished = Api(http.StatusConflict, "TRANSFER_ALREADY_FINISHED", "That transfer is no longer in transit.")
	ReservationNotActive    = Api(http.StatusConflict, "RESERVATION_NOT_ACTIVE", "The stock reservation expired or was released.")
	ReservationConflict     = Api(http.StatusConflict, "RESERVATION_CONFLICT", "That reservation reference was already used for different stock.")
	NothingReservedForOrder = Api(http.StatusConflict, "NOTHING_RESERVED", "No stock is reserved for that order.")
	InvalidStockLocation    = Api(http.StatusBadRequest, "INVALID_LOCATION", "That location does not belong to this store.")
	SameLocationTransfer    = Api(http.StatusBadRequest, "SAME_LOCATION", "Choose two different locations.")
)
