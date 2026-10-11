package controllers

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type SellerConversationsController struct {
	Container *container.Container
	Social    integrations.SocialStoreInboxClient
}

type replyRequest struct {
	Body            *string         `json:"body"`
	Text            *string         `json:"text"`
	Location        json.RawMessage `json:"location"`
	Poll            json.RawMessage `json:"poll"`
	Document        json.RawMessage `json:"document"`
	SharedContent   json.RawMessage `json:"sharedContent"`
	Kind            string          `json:"kind"`
	Encryption      json.RawMessage `json:"encryption"`
	MediaId         string          `json:"mediaId"`
	DurationSeconds *float64        `json:"durationSeconds"`
	LinkPreview     *string         `json:"linkPreview"`
}

var errPlaintextNotAccepted = httpserver.NewApiError(http.StatusUnprocessableEntity, "PLAINTEXT_NOT_ACCEPTED", "Store chats are end-to-end encrypted. Update the seller dashboard to reply: messages must be encrypted on your device.")

func hasRaw(value json.RawMessage) bool {
	return len(value) > 0 && string(value) != "null"
}

func (candidate replyRequest) carriesPlaintext() bool {
	return (candidate.Body != nil && *candidate.Body != "") || (candidate.Text != nil && *candidate.Text != "") || hasRaw(candidate.Location) || hasRaw(candidate.Poll) || hasRaw(candidate.Document) || hasRaw(candidate.SharedContent)
}

func (controller SellerConversationsController) relay(writer http.ResponseWriter, request *http.Request, method, suffix string, body []byte) {
	store := middlewares.StoreAccessFrom(request.Context())
	response, err := controller.Social.Forward(request.Context(), method, "/api/v1/internal/stores/"+store.StoreId.String()+"/conversations"+suffix, body)
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(response.Status)
	_, _ = writer.Write(response.Body)
}

func (controller SellerConversationsController) conversationSuffix(writer http.ResponseWriter, request *http.Request, tail string) (string, bool) {
	conversationId, err := utils.PathIdentifier(request, "conversationId")
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return "", false
	}
	return "/" + conversationId.String() + tail, true
}

func (controller SellerConversationsController) List(writer http.ResponseWriter, request *http.Request) {
	values := url.Values{}
	for _, name := range []string{"filter", "q", "cursor", "limit"} {
		if value := request.URL.Query().Get(name); value != "" {
			values.Set(name, value)
		}
	}
	suffix := ""
	if len(values) > 0 {
		suffix = "?" + values.Encode()
	}
	controller.relay(writer, request, http.MethodGet, suffix, nil)
}

func (controller SellerConversationsController) Get(writer http.ResponseWriter, request *http.Request) {
	values := url.Values{}
	for _, name := range []string{"cursor", "after", "limit"} {
		if value := request.URL.Query().Get(name); value != "" {
			values.Set(name, value)
		}
	}
	tail := ""
	if len(values) > 0 {
		tail = "?" + values.Encode()
	}
	if suffix, ok := controller.conversationSuffix(writer, request, tail); ok {
		controller.relay(writer, request, http.MethodGet, suffix, nil)
	}
}

func (controller SellerConversationsController) Recipients(writer http.ResponseWriter, request *http.Request) {
	if suffix, ok := controller.conversationSuffix(writer, request, "/recipients"); ok {
		controller.relay(writer, request, http.MethodGet, suffix, nil)
	}
}

func (controller SellerConversationsController) Read(writer http.ResponseWriter, request *http.Request) {
	if suffix, ok := controller.conversationSuffix(writer, request, "/read"); ok {
		controller.relay(writer, request, http.MethodPost, suffix, []byte("{}"))
	}
}

func (controller SellerConversationsController) Reply(writer http.ResponseWriter, request *http.Request) {
	suffix, ok := controller.conversationSuffix(writer, request, "/messages")
	if !ok {
		return
	}
	body, err := utils.DecodeAndValidate[replyRequest](writer, request, func(candidate replyRequest) error {
		if candidate.carriesPlaintext() {
			return errPlaintextNotAccepted
		}
		var issues utils.Issues
		if !hasRaw(candidate.Encryption) {
			issues.Add("encryption", "is required")
		}
		return issues.AsError()
	})
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	actorId := middlewares.AccountIdFrom(request.Context())
	name := store.StoreName
	if profiles, lookupError := controller.Container.Users.PersonalProfilesByAccount(request.Context(), []uuid.UUID{actorId}); lookupError == nil && profiles[actorId].Name != "" {
		name = profiles[actorId].Name + " (" + store.StoreName + ")"
	}
	message := map[string]any{"encryption": body.Encryption, "senderAccountId": actorId.String(), "senderName": truncate(name, 80)}
	if key := request.Header.Get("Idempotency-Key"); key != "" {
		message["clientMessageId"] = truncate(key, 100)
	}
	if body.Kind != "" {
		message["kind"] = body.Kind
	}
	if body.MediaId != "" {
		message["mediaId"] = body.MediaId
	}
	if body.DurationSeconds != nil {
		message["durationSeconds"] = *body.DurationSeconds
	}
	if body.LinkPreview != nil {
		message["linkPreview"] = *body.LinkPreview
	}
	forwarded, _ := json.Marshal(message)
	controller.relay(writer, request, http.MethodPost, suffix, forwarded)
}

func (controller SellerConversationsController) OpenForOrder(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	orderId, err := utils.PathIdentifier(request, "orderId")
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	group, err := controller.Container.Client.OrderGroup.Query().Where(ordergroup.ID(orderId), ordergroup.StoreID(store.StoreId)).Only(request.Context())
	if ent.IsNotFound(err) {
		err = ordererrors.OrderNotFound
	}
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	forwarded, _ := json.Marshal(map[string]string{"buyerAccountId": group.BuyerAccountID.String(), "orderId": group.ID.String(), "orderNumber": group.Reference})
	controller.relay(writer, request, http.MethodPost, "/open", forwarded)
}

func truncate(text string, maximum int) string {
	runes := []rune(text)
	if len(runes) > maximum {
		return string(runes[:maximum])
	}
	return text
}
