package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"nantty/platform/httpserver"
)

var errDocumentUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "DOCUMENT_UNAVAILABLE", "This document cannot be opened right now. Try again.")

type HttpPrivateMediaSigner struct {
	BaseUrl string
	Token   string
	Client  *http.Client
}

func NewHttpPrivateMediaSigner(baseUrl, token string) HttpPrivateMediaSigner {
	return HttpPrivateMediaSigner{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Client: &http.Client{Timeout: 5 * time.Second}}
}

func (signer HttpPrivateMediaSigner) SignedUrl(ctx context.Context, mediaId, actorId, reason string) (string, time.Time, error) {
	if signer.BaseUrl == "" {
		return "", time.Time{}, errDocumentUnavailable
	}
	encoded, _ := json.Marshal(map[string]any{"actorId": actorId, "reason": reason})
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, signer.BaseUrl+"/internal/v1/media/"+url.PathEscape(mediaId)+"/signed-url", bytes.NewReader(encoded))
	if err != nil {
		return "", time.Time{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", signer.Token)
	response, err := signer.Client.Do(request)
	if err != nil {
		return "", time.Time{}, errDocumentUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return "", time.Time{}, httpserver.NewApiError(http.StatusNotFound, "NOT_FOUND", "That document could not be found.")
	}
	var body struct {
		Url       string    `json:"url"`
		ExpiresAt time.Time `json:"expiresAt"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&body) != nil || body.Url == "" {
		return "", time.Time{}, errDocumentUnavailable
	}
	return body.Url, body.ExpiresAt, nil
}
