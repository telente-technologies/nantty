package controllers

import (
	"crypto/subtle"
	"net/http"
	"net/netip"

	"nantty/modules/admin/src/modules/staffAdmins/services"
	"nantty/platform/httpserver"
)

func (controller StaffAdminsController) NetworkPolicy(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.InternalApiToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	address := request.URL.Query().Get("address")
	if _, err := netip.ParseAddr(address); err != nil {
		httpserver.WriteJsonResponse(writer, http.StatusBadRequest, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ADDRESS", "address must be an IP address."))
		return
	}
	allowed, err := services.StaffNetworkPolicy{Container: controller.Container}.IsStaffAddressAllowed(request.Context(), request.PathValue("staffId"), address)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"allowed": allowed})
}
