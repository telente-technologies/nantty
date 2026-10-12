package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/generated/ent/orderitem"
	"zudomart/modules/orders/src/generated/ent/outboxevent"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/jwtauth"
)

type cartClient struct {
	t     *testing.T
	mux   *http.ServeMux
	token string
}

func startCartHttp(t *testing.T) (*commerceHarness, *http.ServeMux, *identitytest.FakeTokenService) {
	harness := startCommerce(t)
	tokens := identitytest.NewFakeTokenService(t)
	harness.orders.Container.AccessVerifier = jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, identitytest.FakeAccountAudience)
	mux := http.NewServeMux()
	harness.orders.MountRoutes(mux)
	return harness, mux, tokens
}

func (client cartClient) call(method, path string, body any) (int, map[string]any) {
	var payload bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&payload).Encode(body)
	}
	request := httptest.NewRequest(method, path, &payload)
	request.Header.Set("Authorization", "Bearer "+client.token)
	recorder := httptest.NewRecorder()
	client.mux.ServeHTTP(recorder, request)
	decoded := map[string]any{}
	_ = json.Unmarshal(recorder.Body.Bytes(), &decoded)
	return recorder.Code, decoded
}

func (harness *commerceHarness) productId(t *testing.T) string {
	snapshots, err := mustCatalog().ResolveProductsForCheckout(context.Background(), []uuid.UUID{harness.variantId})
	if err != nil {
		t.Fatal(err)
	}
	return snapshots[harness.variantId].ProductId.String()
}

func amountOf(view map[string]any, field string) float64 {
	return view[field].(map[string]any)["amountMinor"].(float64)
}

func TestCartTotalsUseServerPricesAndEnforceQuantityAndStockLimits(t *testing.T) {
	harness, mux, tokens := startCartHttp(t)
	buyer := cartClient{t: t, mux: mux, token: tokens.SignAccountAccessToken(t, harness.buyer.String())}
	productId := harness.productId(t)
	if status, body := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 1, "unitPrice": 1}); status != http.StatusBadRequest {
		t.Fatalf("a client price is refused, never used: %d %v", status, body)
	}
	for _, quantity := range []int{0, 100} {
		if status, _ := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": quantity}); status != http.StatusBadRequest {
			t.Fatalf("quantity %d must be refused: %d", quantity, status)
		}
	}
	if status, body := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 6}); status != http.StatusConflict || body["code"] != "INSUFFICIENT_STOCK" {
		t.Fatalf("more than the stock: %d %v", status, body)
	}
	status, view := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 2})
	if status != http.StatusOK || amountOf(view, "itemsTotal") != 1_000_000 || len(view["groups"].([]any)) != 1 {
		t.Fatalf("cart after adding two shirts: %d %v", status, view)
	}
	group := view["groups"].([]any)[0].(map[string]any)
	if group["storeId"] != harness.storeId.String() || amountOf(group, "subtotal") != 1_000_000 {
		t.Fatalf("per-store totals: %v", group)
	}
	if status, _ := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 4}); status != http.StatusConflict {
		t.Fatalf("the merged line must respect stock too: %d", status)
	}
}

func TestCartIsPrivateToItsBuyer(t *testing.T) {
	harness, mux, tokens := startCartHttp(t)
	buyer := cartClient{t: t, mux: mux, token: tokens.SignAccountAccessToken(t, harness.buyer.String())}
	stranger := cartClient{t: t, mux: mux, token: tokens.SignAccountAccessToken(t, uuid.NewString())}
	_, view := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": harness.productId(t), "quantity": 1})
	itemId := view["items"].([]any)[0].(map[string]any)["id"].(string)
	if status, other := stranger.call("GET", "/api/v1/cart", nil); status != http.StatusOK || len(other["items"].([]any)) != 0 {
		t.Fatalf("another buyer sees an empty cart: %d %v", status, other)
	}
	if status, body := stranger.call("PATCH", "/api/v1/cart/items/"+itemId, map[string]any{"quantity": 3}); status != http.StatusNotFound || body["code"] != "CART_ITEM_NOT_FOUND" {
		t.Fatalf("another buyer cannot change the item: %d %v", status, body)
	}
	if status, _ := stranger.call("DELETE", "/api/v1/cart/items/"+itemId, nil); status != http.StatusNotFound {
		t.Fatalf("another buyer cannot remove the item: %d", status)
	}
	if status, _ := (cartClient{t: t, mux: mux}).call("GET", "/api/v1/cart", nil); status != http.StatusUnauthorized {
		t.Fatalf("the cart needs a signed-in buyer: %d", status)
	}
}

func TestSaleAttributionIsKeptFromCartToOrderAndCompletionEvents(t *testing.T) {
	harness, mux, tokens := startCartHttp(t)
	buyer := cartClient{t: t, mux: mux, token: tokens.SignAccountAccessToken(t, harness.buyer.String())}
	productId, clipId := harness.productId(t), uuid.NewString()
	if status, _ := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 1, "attribution": map[string]any{"source": "banner", "id": clipId}}); status != http.StatusBadRequest {
		t.Fatalf("an unknown attribution source is refused: %d", status)
	}
	status, view := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 1, "attribution": map[string]any{"source": "clip", "id": clipId}})
	if status != http.StatusOK || view["items"].([]any)[0].(map[string]any)["attribution"].(map[string]any)["id"] != clipId {
		t.Fatalf("attribution on the cart line: %d %v", status, view)
	}
	buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 1})
	_, view = buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 1, "attribution": map[string]any{"source": "post", "id": uuid.NewString()}})
	line := view["items"].([]any)[0].(map[string]any)
	if line["quantity"].(float64) != 3 || line["attribution"].(map[string]any)["source"] != "clip" {
		t.Fatalf("the first attribution is kept: %v", line)
	}
	if status, _ := buyer.call("POST", "/api/v1/cart/items", map[string]any{"productId": productId, "quantity": 1, "attribution": map[string]any{"source": "link", "id": uuid.NewString()}}); status != http.StatusOK {
		t.Fatalf("an affiliate link is an attribution source: %d", status)
	}
	ctx := context.Background()
	result, err := (services.CheckoutService{Container: harness.orders.Container}).Checkout(ctx, services.CheckoutRequest{BuyerId: harness.buyer, AddressId: harness.addressId, IdempotencyKey: "checkout-attribution-1"})
	if err != nil {
		t.Fatal(err)
	}
	orderId := uuid.MustParse(result.OrderGroups[0].Id)
	item := harness.orders.Container.Client.OrderItem.Query().Where(orderitem.OrderGroupID(orderId)).OnlyX(ctx)
	if item.AttributionSource == nil || *item.AttributionSource != "clip" || item.AttributionID.String() != clipId {
		t.Fatalf("order item attribution: %+v", item)
	}
	if err := services.RecordOrderPaid(ctx, harness.orders.Container, orderId); err != nil {
		t.Fatal(err)
	}
	harness.orders.Container.Client.OrderGroup.UpdateOneID(orderId).SetStatus("delivered").ExecX(ctx)
	if err := services.CompleteOrderGroup(ctx, harness.orders.Container, orderId, services.SystemActor, "Escrow released to the seller"); err != nil {
		t.Fatal(err)
	}
	for _, eventType := range []string{"orderGroup.paid", "orderGroup.completed"} {
		row := harness.orders.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType(eventType)).OnlyX(ctx)
		var data struct {
			OrderNumber     string                        `json:"orderNumber"`
			OrderedAt       *time.Time                    `json:"orderedAt"`
			AttributedItems []services.AttributedSaleItem `json:"attributedItems"`
		}
		if err := json.Unmarshal(eventPayload(t, row.Payload), &data); err != nil || len(data.AttributedItems) != 1 || data.AttributedItems[0].AttributionId.String() != clipId || data.AttributedItems[0].Quantity != 4 ||
			data.OrderNumber == "" || data.OrderedAt == nil || data.AttributedItems[0].AttributedAt == nil {
			t.Fatalf("%s attributed items: %s %v", eventType, row.Payload, err)
		}
	}
}

func eventPayload(t *testing.T, payload []byte) []byte {
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		t.Fatal(err)
	}
	return envelope.Data
}
