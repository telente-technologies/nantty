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
	token, err := verifier.tokens.AccessToken(ctx)
	if err != nil {
		return err
	}
	target := strings.TrimRight(verifier.settings.ApiBaseUrl, "/") + "/androidpublisher/v3/applications/" + url.PathEscape(verifier.settings.PackageName) +
		"/purchases/subscriptionsv2/tokens/" + url.PathEscape(purchaseToken) + ":revoke"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader([]byte(`{"revokeContext":{"fullRefund":{}}}`)))
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
		return fmt.Errorf("%w: google play revoke returned %d", interfaces.ErrProviderUnavailable, response.StatusCode)
	}
	return nil
}
