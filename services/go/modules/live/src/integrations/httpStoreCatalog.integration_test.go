package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestHttpStoreCatalogSendsTheTokenParsesSnapshotsAndFailsClosed(t *testing.T) {
	storeId, userId, productId := uuid.New(), uuid.New(), uuid.New()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-Internal-Token") != "catalog-token" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch request.URL.Path {
		case "/internal/v1/stores/" + storeId.String() + "/members/" + userId.String():
			_, _ = writer.Write([]byte(`{"isMember":true,"role":"owner"}`))
		case "/internal/v1/stores/" + storeId.String() + "/products/ownership":
			var body struct {
				ProductIds []string `json:"productIds"`
			}
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil || len(body.ProductIds) != 2 {
				writer.WriteHeader(http.StatusBadRequest)
				return
			}
			_, _ = writer.Write([]byte(`{"owned":["` + productId.String() + `"],"products":[{"id":"` + productId.String() + `","title":"Shoe","price":{"amountMinor":5000,"currency":"NGN"},"imageUrl":null}]}`))
		default:
			writer.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer server.Close()
	ctx := context.Background()
	catalog := NewHttpStoreCatalog(server.URL+"/", "catalog-token", time.Second)
	if member, err := catalog.IsStoreMember(ctx, storeId, userId); err != nil || !member {
		t.Fatalf("membership: %v %v", member, err)
	}
	owned, err := catalog.OwnedProducts(ctx, storeId, []uuid.UUID{productId, uuid.New()})
	if err != nil || len(owned) != 1 || owned[productId].Title != "Shoe" || owned[productId].PriceMinor != 5000 || owned[productId].Currency != "NGN" {
		t.Fatalf("ownership: %v %v", owned, err)
	}
	for name, broken := range map[string]HttpStoreCatalog{
		"wrong token":  NewHttpStoreCatalog(server.URL, "nope", time.Second),
		"server error": NewHttpStoreCatalog(server.URL+"/elsewhere", "catalog-token", time.Second),
		"unconfigured": NewHttpStoreCatalog("", "catalog-token", time.Second),
		"unreachable":  NewHttpStoreCatalog("http://127.0.0.1:1", "catalog-token", time.Second),
	} {
		if member, err := broken.IsStoreMember(ctx, storeId, userId); member || !errors.Is(err, ErrCatalogUnavailable) {
			t.Fatalf("%s must fail closed, got %v %v", name, member, err)
		}
	}
}
