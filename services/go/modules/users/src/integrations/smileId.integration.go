package integrations

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

var ErrSmileIdNotConfigured = errors.New("smile id is not configured")

type SmileIdClient struct {
	PartnerId   string
	ApiKey      string
	BaseUrl     string
	CallbackUrl string
	Http        *http.Client
	Now         func() time.Time
}

type SmileIdIdType struct {
	Country            string `json:"country"`
	IdType             string `json:"id_type"`
	VerificationMethod string `json:"verification_method"`
}

type SmileLinkRequest struct {
	UserId           string
	JobId            string
	Name             string
	CompanyName      string
	PrivacyPolicyUrl string
	IdTypes          []SmileIdIdType
	ExpiresAt        time.Time
}

func ComputeSmileIdSignature(apiKey, partnerId, timestamp string) string {
	mac := hmac.New(sha256.New, []byte(apiKey))
	mac.Write([]byte(timestamp + partnerId + "sid_request"))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func VerifySmileIdSignature(apiKey, partnerId, timestamp, signature string) bool {
	if apiKey == "" || partnerId == "" || timestamp == "" || signature == "" {
		return false
	}
	expected := ComputeSmileIdSignature(apiKey, partnerId, timestamp)
	return subtle.ConstantTimeCompare([]byte(expected), []byte(signature)) == 1
}

func (client *SmileIdClient) signedBody(fields map[string]any) map[string]any {
	timestamp := client.Now().UTC().Format(time.RFC3339Nano)
	fields["partner_id"], fields["timestamp"], fields["signature"] = client.PartnerId, timestamp, ComputeSmileIdSignature(client.ApiKey, client.PartnerId, timestamp)
	return fields
}

func (client *SmileIdClient) CreateWebToken(ctx context.Context, userId, jobId, product string) (string, error) {
	var response struct {
		Success bool   `json:"success"`
		Token   string `json:"token"`
	}
	body := client.signedBody(map[string]any{"user_id": userId, "job_id": jobId, "product": product, "callback_url": client.CallbackUrl})
	if err := client.post(ctx, "/token", body, &response); err != nil {
		return "", err
	}
	if !response.Success || response.Token == "" {
		return "", errors.New("smile id: token request was not successful")
	}
	return response.Token, nil
}

func (client *SmileIdClient) CreateSmileLink(ctx context.Context, request SmileLinkRequest) (string, error) {
	var response struct {
		Link string `json:"link"`
	}
	body := client.signedBody(map[string]any{
		"name": request.Name, "company_name": request.CompanyName, "id_types": request.IdTypes, "callback_url": client.CallbackUrl,
		"data_privacy_policy_url": request.PrivacyPolicyUrl, "is_single_use": true, "user_id": request.UserId,
		"partner_params": map[string]string{"job_id": request.JobId}, "expires_at": request.ExpiresAt.UTC().Format(time.RFC3339),
	})
	if err := client.post(ctx, "/smile_links", body, &response); err != nil {
		return "", err
	}
	if response.Link == "" {
		return "", errors.New("smile id: no link was returned")
	}
	return response.Link, nil
}

func (client *SmileIdClient) post(ctx context.Context, path string, body, destination any) error {
	if client == nil || client.PartnerId == "" || client.ApiKey == "" {
		return ErrSmileIdNotConfigured
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.BaseUrl+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Http.Do(request)
	if err != nil {
		return fmt.Errorf("smile id: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		return fmt.Errorf("smile id: %s returned status %d", path, response.StatusCode)
	}
	return json.NewDecoder(response.Body).Decode(destination)
}
