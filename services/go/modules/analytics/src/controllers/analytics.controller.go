package controllers

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/analytics/src/services"
	"nantty/modules/analytics/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type AnalyticsController struct {
	Service       services.Service
	CatalogReader func() (commerceports.CatalogReader, error)
	Logger        *slog.Logger
}

type ingestBatchRequest struct {
	Events []types.IngestEventInput `json:"events"`
}

func (controller AnalyticsController) IngestEvents(writer http.ResponseWriter, request *http.Request) {
	principal, found := jwtauth.PrincipalFromContext(request.Context())
	if !found {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	var body ingestBatchRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	result, err := controller.Service.IngestBatch(request.Context(), principal.UserId, principal.AgeBracket, body.Events)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, result)
}

func (controller AnalyticsController) IngestInternalEvents(writer http.ResponseWriter, request *http.Request) {
	var body ingestBatchRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	result, err := controller.Service.IngestInternalBatch(request.Context(), body.Events)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusAccepted, result)
}

func (controller AnalyticsController) CreatorSummary(writer http.ResponseWriter, request *http.Request) {
	principal, found := jwtauth.PrincipalFromContext(request.Context())
	if !found {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	summary, err := controller.Service.CreatorSummary(request.Context(), principal.UserId, request.URL.Query().Get("window"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, summary)
}

func (controller AnalyticsController) SellerSummary(writer http.ResponseWriter, request *http.Request) {
	principal, found := jwtauth.PrincipalFromContext(request.Context())
	if !found {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	accountId, err := uuid.Parse(principal.UserId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, httpserver.ErrUnauthorized)
		return
	}
	readCatalog := controller.CatalogReader
	if readCatalog == nil {
		readCatalog = commerceports.Default.CatalogReader
	}
	catalog, err := readCatalog()
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, httpserver.NewApiError(http.StatusServiceUnavailable, "STORE_AUTHORIZATION_UNAVAILABLE", "Store authorization service is unavailable."))
		return
	}
	var requestedStore *uuid.UUID
	rawStoreId := strings.TrimSpace(request.Header.Get("X-Seller-Store"))
	if rawStoreId == "" {
		rawStoreId = strings.TrimSpace(request.URL.Query().Get("storeId"))
	}
	if rawStoreId != "" {
		parsed, parseErr := uuid.Parse(rawStoreId)
		if parseErr != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_STORE_ID", "Invalid storeId."))
			return
		}
		requestedStore = &parsed
	}
	access, memberFound, err := catalog.FindStoreAccessForAccount(request.Context(), accountId, requestedStore)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	if !memberFound {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, httpserver.NewApiError(http.StatusForbidden, "NOT_STORE_MEMBER", "You are not a member of this store."))
		return
	}
	if !access.Allows("analytics:view") {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "You do not have permission to view store analytics."))
		return
	}
	summary, err := controller.Service.SellerSummary(request.Context(), access.StoreId.String(), request.URL.Query().Get("window"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, summary)
}

func (controller AnalyticsController) PlatformOverview(writer http.ResponseWriter, request *http.Request) {
	overview, err := controller.Service.PlatformOverview(request.Context(), request.URL.Query().Get("window"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, overview)
}
