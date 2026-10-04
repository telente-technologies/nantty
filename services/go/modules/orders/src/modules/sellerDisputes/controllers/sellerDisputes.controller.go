package controllers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/utils"
)

type SellerDisputesController struct {
	Container *container.Container
	Money     integrations.MoneyDisputesClient
}

type disputeResponseRequest struct {
	Body string `json:"body"`
}

func (controller SellerDisputesController) relay(writer http.ResponseWriter, request *http.Request, method, suffix string, body []byte) {
	store := middlewares.StoreAccessFrom(request.Context())
	path := "/api/v1/internal/stores/" + store.StoreId.String() + "/disputes" + suffix
	response, err := controller.Money.Forward(request.Context(), method, path, body, request.Header.Get("Idempotency-Key"))
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(response.Status)
	_, _ = writer.Write(response.Body)
}

func (controller SellerDisputesController) List(writer http.ResponseWriter, request *http.Request) {
	query := url.Values{}
	for _, name := range []string{"status", "cursor", "limit"} {
		if value := request.URL.Query().Get(name); value != "" {
			query.Set(name, value)
		}
	}
	suffix := ""
	if len(query) > 0 {
		suffix = "?" + query.Encode()
	}
	controller.relay(writer, request, http.MethodGet, suffix, nil)
}

func (controller SellerDisputesController) Get(writer http.ResponseWriter, request *http.Request) {
	disputeId, err := utils.PathIdentifier(request, "disputeId")
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	controller.relay(writer, request, http.MethodGet, "/"+disputeId.String(), nil)
}

func (controller SellerDisputesController) Respond(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	disputeId, err := utils.PathIdentifier(request, "disputeId")
	var body disputeResponseRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[disputeResponseRequest](writer, request, func(candidate disputeResponseRequest) error {
			var collected utils.Issues
			collected.CheckLength("body", candidate.Body, 10, 2000)
			return collected.AsError()
		})
	}
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	forwarded, _ := json.Marshal(map[string]string{"authorUserId": middlewares.AccountIdFrom(request.Context()).String(), "text": strings.TrimSpace(body.Body)})
	controller.relay(writer, request, http.MethodPost, "/"+disputeId.String()+"/responses", forwarded)
}
