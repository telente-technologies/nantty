package integrations

import (
	"context"
	"net/http"
	"time"

	"nantty/platform/httpserver"
)

var ErrStoreInboxUnavailable = httpserver.NewApiError(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "Messages are unavailable right now. Try again.")

type SocialStoreInboxClient struct {
	forwarder MoneySellerAccountsClient
}

func NewSocialStoreInboxClient(baseUrl, token string) SocialStoreInboxClient {
	return SocialStoreInboxClient{forwarder: MoneySellerAccountsClient{BaseUrl: baseUrl, Token: token, Http: &http.Client{Timeout: 5 * time.Second}}}
}

func (client SocialStoreInboxClient) Forward(ctx context.Context, method, path string, body []byte) (MoneySellerResponse, error) {
	response, err := client.forwarder.Forward(ctx, method, path, nil, body)
	if err != nil {
		return MoneySellerResponse{}, ErrStoreInboxUnavailable
	}
	return response, nil
}
