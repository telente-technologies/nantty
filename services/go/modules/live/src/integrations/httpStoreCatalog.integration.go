package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
)

var ErrCatalogUnavailable = errors.New("catalog is unavailable")

type HttpStoreCatalog struct {
	BaseUrl string
	Token   string
	Client  *http.Client
}

func NewHttpStoreCatalog(baseUrl, token string, timeout time.Duration) HttpStoreCatalog {
	return HttpStoreCatalog{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Client: &http.Client{Timeout: timeout}}
}

type ownershipResponse struct {
	Owned    []string `json:"owned"`
	Products []struct {
		Id    string `json:"id"`
		Title string `json:"title"`
		Price struct {
			AmountMinor int64  `json:"amountMinor"`
			Currency    string `json:"currency"`
		} `json:"price"`
		ImageUrl *string `json:"imageUrl"`
		Status   string  `json:"status"`
	} `json:"products"`
}

func (catalog HttpStoreCatalog) IsStoreMember(ctx context.Context, storeId, userId uuid.UUID) (bool, error) {
	var answer struct {
		IsMember bool `json:"isMember"`
	}
	err := catalog.call(ctx, http.MethodGet, "/internal/v1/stores/"+storeId.String()+"/members/"+userId.String(), nil, &answer)
	return answer.IsMember, err
}

func (catalog HttpStoreCatalog) OwnedProducts(ctx context.Context, storeId uuid.UUID, productIds []uuid.UUID) (map[uuid.UUID]interfaces.StoreProduct, error) {
	owned := map[uuid.UUID]interfaces.StoreProduct{}
	identifiers := make([]string, len(productIds))
	for index, productId := range productIds {
		identifiers[index] = productId.String()
	}
	var answer ownershipResponse
	if err := catalog.call(ctx, http.MethodPost, "/internal/v1/stores/"+storeId.String()+"/products/ownership", map[string]any{"productIds": identifiers}, &answer); err != nil {
		return nil, err
	}
	for _, product := range answer.Products {
		identifier, err := uuid.Parse(product.Id)
		if err != nil {
			continue
		}
		owned[identifier] = interfaces.StoreProduct{
			Id: identifier, Title: product.Title, PriceMinor: product.Price.AmountMinor, Currency: product.Price.Currency, ImageUrl: product.ImageUrl, Status: product.Status,
		}
	}
	return owned, nil
}

func (catalog HttpStoreCatalog) call(ctx context.Context, method, path string, body any, into any) error {
	if catalog.BaseUrl == "" {
		return ErrCatalogUnavailable
	}
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, catalog.BaseUrl+path, reader)
	if err != nil {
		return err
	}
	request.Header.Set("X-Internal-Token", catalog.Token)
	request.Header.Set("Content-Type", "application/json")
	response, err := catalog.Client.Do(request)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrCatalogUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: catalog answered %d", ErrCatalogUnavailable, response.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(into); err != nil {
		return fmt.Errorf("%w: %v", ErrCatalogUnavailable, err)
	}
	return nil
}
