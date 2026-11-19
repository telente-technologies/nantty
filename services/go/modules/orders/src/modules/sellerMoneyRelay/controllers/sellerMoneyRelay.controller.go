package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"strings"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/integrations"
	"nantty/modules/orders/src/middlewares"
	"nantty/modules/orders/src/modules/sellerMoneyRelay/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

const maximumRelayedBodyBytes = 64 << 10

var relayedQueryParameters = []string{"cursor", "limit", "kind", "from", "to", "month", "status", "q"}
var returnedHeaders = []string{"Content-Type", "Content-Disposition", "Idempotent-Replayed"}

type SellerMoneyRelayController struct {
	Container *container.Container
	Money     integrations.MoneySellerAccountsClient
}

type AuditedAction struct {
	Action     string
	TargetType string
}

func (controller SellerMoneyRelayController) Relay(suffix string, audit *AuditedAction) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		responder := utils.Responder{Logger: controller.Container.Logger}
		store := middlewares.StoreAccessFrom(request.Context())
		actorId := middlewares.AccountIdFrom(request.Context())
		var body []byte
		if request.Method != http.MethodGet {
			read, err := io.ReadAll(http.MaxBytesReader(writer, request.Body, maximumRelayedBodyBytes))
			if err != nil {
				responder.Error(writer, request, httpserver.NewApiError(http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "The request body is too large."))
				return
			}
			body = read
		}
		path := "/api/v1/internal/sellers/" + store.OwnerAccountId.String() + expandPathValues(suffix, request) + relayedQuery(request)
		headers := map[string]string{
			"X-Seller-Store-Id": store.StoreId.String(), "X-Store-Currency": string(store.Currency), "X-Store-Country": store.CountryCode,
			"X-Store-Timezone": store.Timezone, "X-Store-Name": store.StoreName, "X-Actor-Id": actorId.String(), "Idempotency-Key": request.Header.Get("Idempotency-Key"),
		}
		if token := strings.TrimSpace(request.Header.Get(jwtauth.UserStepUpHeader)); token != "" {
			digest := sha256.Sum256([]byte(token))
			headers["X-Step-Up-Token-Digest"] = hex.EncodeToString(digest[:])
		}
		response, err := controller.Money.Forward(request.Context(), request.Method, path, headers, body)
		if err != nil {
			responder.Error(writer, request, err)
			return
		}
		if audit != nil && response.Status < 300 && response.Headers.Get("Idempotent-Replayed") != "true" {
			services.RecordSellerMoneyAudit(request.Context(), controller.Container, request, store, actorId, audit.Action, audit.TargetType, response.Body)
		}
		for _, name := range returnedHeaders {
			if value := response.Headers.Get(name); value != "" {
				writer.Header().Set(name, value)
			}
		}
		writer.WriteHeader(response.Status)
		_, _ = writer.Write(response.Body)
	}
}

func expandPathValues(suffix string, request *http.Request) string {
	for _, name := range []string{"accountId", "settlementId", "month", "bankCode"} {
		placeholder := "{" + name + "}"
		if strings.Contains(suffix, placeholder) {
			suffix = strings.ReplaceAll(suffix, placeholder, url.PathEscape(request.PathValue(name)))
		}
	}
	return suffix
}

func relayedQuery(request *http.Request) string {
	values := url.Values{}
	for _, name := range relayedQueryParameters {
		if value := request.URL.Query().Get(name); value != "" {
			values.Set(name, value)
		}
	}
	if len(values) == 0 {
		return ""
	}
	return "?" + values.Encode()
}
