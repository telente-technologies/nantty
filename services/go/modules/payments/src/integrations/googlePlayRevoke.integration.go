package integrations

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"zudomart/modules/payments/src/interfaces"
)

func (verifier *GooglePlayVerifier) RevokeSubscriptionWithFullRefund(ctx context.Context, purchaseToken string) error {
	return verifier.postPublisherAction(ctx, "/purchases/subscriptionsv2/tokens/"+url.PathEscape(purchaseToken)+":revoke", `{"revokeContext":{"fullRefund":{}}}`)
}

func (verifier *GooglePlayVerifier) AcknowledgeSubscription(ctx context.Context, productId, purchaseToken string) error {
	return verifier.postPublisherAction(ctx, "/purchases/subscriptions/"+url.PathEscape(productId)+"/tokens/"+url.PathEscape(purchaseToken)+":acknowledge", `{}`)
}

func (verifier *GooglePlayVerifier) postPublisherAction(ctx context.Context, path, body string) error {
	token, err := verifier.tokens.AccessToken(ctx)
	if err != nil {
		return err
	}
	target := strings.TrimRight(verifier.settings.ApiBaseUrl, "/") + "/androidpublisher/v3/applications/" + url.PathEscape(verifier.settings.PackageName) + path
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader([]byte(body)))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	response, err := verifier.settings.HttpClient.Do(request)
	if err != nil {
		return fmt.Errorf("%w: %v", interfaces.ErrProviderUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		return fmt.Errorf("%w: google play %s returned %d", interfaces.ErrProviderUnavailable, path[strings.LastIndex(path, ":")+1:], response.StatusCode)
	}
	return nil
}
