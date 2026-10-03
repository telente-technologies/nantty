package errors

import "net/http"

var (
	ReturnNotFound      = Api(http.StatusNotFound, "RETURN_NOT_FOUND", "That return could not be found.")
	ReturnStateConflict = Api(http.StatusConflict, "RETURN_STATE_CONFLICT", "That return is not in a state that allows this change.")
	ReturnNotAllowed    = Api(http.StatusConflict, "RETURN_NOT_ALLOWED", "Only delivered or completed orders can be returned, once at a time.")
	ReturnLinesInvalid  = Api(http.StatusUnprocessableEntity, "RETURN_LINES_INVALID", "Choose items and quantities from this order.")
)
