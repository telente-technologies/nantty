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
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
)

var ErrSmileIdNotConfigured = errors.New("smile id is not configured")

var smileIdPartnerIdPattern = regexp.MustCompile(`^[1-9][0-9]*$`)

type SmileIdClient struct {
	PartnerId             string
	ApiKey                string
	BaseUrl               string
	CallbackUrl           string
	WebSdkCallbackUrl     string
	HostedLinkCallbackUrl string
	Http                  *http.Client
	Now                   func() time.Time
	configMu              sync.RWMutex
	configCache           map[string]smileIdConfigCacheEntry
	catalogMu             sync.RWMutex
	catalogCache          map[string]smileIdCatalogCacheEntry
	catalogCacheBytes     int
}

type smileIdConfigCacheEntry struct {
	value     map[string][]string
	expiresAt time.Time
}

type smileIdCatalogCacheEntry struct {
	body      []byte
	expiresAt time.Time
}

type SmileIdCaptureRequest struct {
	CaseId           string
	CaptureAttemptID string
	Product          string
	Country          string
	DocumentType     string
	ConsentAt        time.Time
	PrivacyPolicyUrl string
	RedirectUrl      string
	ExpiresAt        time.Time
}

type SmileIdIdType struct {
	Country            string `json:"country"`
	IdType             string `json:"id_type"`
	VerificationMethod string `json:"verification_method"`
}

type SmileIdDocumentType struct {
	Code    string `json:"code"`
	Name    string `json:"name"`
	HasBack bool   `json:"has_back"`
}

type SmileIdDocumentCountry struct {
	Country struct {
		Code string `json:"code"`
		Name string `json:"name"`
	} `json:"country"`
	IDTypes []SmileIdDocumentType `json:"id_types"`
}

type SmileIdSupportedKycType struct {
	Country        string   `json:"country"`
	Type           string   `json:"type"`
	Label          string   `json:"label"`
	Regex          string   `json:"regex"`
	RequiredFields []string `json:"required_fields"`
	BankCode       string   `json:"bank_code,omitempty"`
}

func ComputeSmileIdSignature(apiKey, partnerId, timestamp string) string {
	mac := hmac.New(sha256.New, []byte(apiKey))
	_, _ = mac.Write([]byte(timestamp + partnerId + "sid_request"))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func VerifySmileIdSignature(apiKey, partnerId, timestamp, signature string) bool {
	if apiKey == "" || partnerId == "" || timestamp == "" || signature == "" {
		return false
	}
	expected := ComputeSmileIdSignature(apiKey, partnerId, timestamp)
	return subtle.ConstantTimeCompare([]byte(expected), []byte(signature)) == 1
}

func (client *SmileIdClient) CreateWebToken(ctx context.Context, capture SmileIdCaptureRequest) (string, error) {
	if err := client.validateCapture(capture); err != nil {
		return "", err
	}
	callbackURL := client.webSdkCallbackURL()
	if err := validateHttpsUrl(callbackURL); err != nil {
		return "", fmt.Errorf("smile id: invalid web SDK callback URL: %w", err)
	}
	consent, err := json.Marshal(map[string]any{
		"granted": true, "granted_at": capture.ConsentAt.UTC().Format(time.RFC3339Nano),
		"notice_language": "EN", "notice_privacy_policy_url": capture.PrivacyPolicyUrl,
	})
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(map[string]any{
		"country": capture.Country, "id_type": capture.DocumentType, "callback_url": callbackURL, "consent": json.RawMessage(consent),
	})
	if err != nil {
		return "", err
	}
	partnerParams, err := json.Marshal(smileCapturePartnerParams(capture))
	if err != nil {
		return "", err
	}
	var response struct {
		Token string `json:"token"`
	}
	fields := map[string]string{"product": capture.Product, "user_id": SmileIdUserIDForCaptureAttempt(capture.CaptureAttemptID), "payload": string(payload), "partner_params": string(partnerParams)}
	if err := client.postV3Multipart(ctx, "/v3/token", fields, "", &response); err != nil {
		return "", err
	}
	if response.Token == "" {
		return "", errors.New("smile id: token response was empty")
	}
	return response.Token, nil
}

func (client *SmileIdClient) CreateSmileLink(ctx context.Context, capture SmileIdCaptureRequest) (string, error) {
	if err := client.validateCapture(capture); err != nil {
		return "", err
	}
	callbackURL := client.hostedLinkCallbackURL()
	if err := validateHttpsUrl(callbackURL); err != nil {
		return "", fmt.Errorf("smile id: invalid hosted-link callback URL: %w", err)
	}
	consent, err := json.Marshal(map[string]any{
		"granted": true, "granted_at": capture.ConsentAt.UTC().Format(time.RFC3339Nano),
		"notice_language": "EN", "notice_privacy_policy_url": capture.PrivacyPolicyUrl,
	})
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(map[string]any{
		"country": capture.Country, "id_type": capture.DocumentType, "consent": json.RawMessage(consent),
	})
	if err != nil {
		return "", err
	}
	partnerParams, err := json.Marshal(smileCapturePartnerParams(capture))
	if err != nil {
		return "", err
	}
	var tokenResponse struct {
		Token string `json:"token"`
	}
	userID := SmileIdUserIDForCaptureAttempt(capture.CaptureAttemptID)
	tokenFields := map[string]string{"product": capture.Product, "user_id": userID, "payload": string(payload), "partner_params": string(partnerParams)}
	if err := client.postV3Multipart(ctx, "/v3/token", tokenFields, "", &tokenResponse); err != nil {
		return "", err
	}
	if tokenResponse.Token == "" {
		return "", errors.New("smile id: token response was empty")
	}
	idTypes, err := json.Marshal([]SmileIdIdType{{Country: capture.Country, IdType: capture.DocumentType, VerificationMethod: capture.Product}})
	if err != nil {
		return "", err
	}
	fields := map[string]string{
		"name": "Nantty checkmark verification", "notice_privacy_policy_url": capture.PrivacyPolicyUrl,
		"is_single_use": "true", "callback_url": callbackURL,
		"expires_at": capture.ExpiresAt.UTC().Format(time.RFC3339Nano),
		"id_types":   string(idTypes), "partner_params": string(partnerParams),
	}
	if capture.RedirectUrl != "" {
		if err := validateHttpsUrl(capture.RedirectUrl); err != nil {
			return "", fmt.Errorf("smile id: invalid redirect URL: %w", err)
		}
		fields["redirect_url"] = capture.RedirectUrl
	}
	var response struct {
		Link    string  `json:"link"`
		Message *string `json:"message"`
		RefID   string  `json:"ref_id"`
		UserID  string  `json:"user_id"`
	}
	if err := client.postV3Multipart(ctx, "/v3/smile_links", fields, tokenResponse.Token, &response); err != nil {
		return "", err
	}
	if response.Message == nil {
		return "", errors.New("smile id: link response omitted its creation message")
	}
	if err := validateHttpsUrl(response.Link); err != nil {
		return "", errors.New("smile id: link response was invalid")
	}
	if _, err := uuid.Parse(response.RefID); err != nil || response.UserID != userID {
		return "", errors.New("smile id: link response did not match the requested capture")
	}
	return response.Link, nil
}

func SmileIdUserIDForCaptureAttempt(attemptID string) string {
	return "nantty-capture-" + attemptID
}

func (client *SmileIdClient) webSdkCallbackURL() string {
	if client.WebSdkCallbackUrl != "" {
		return client.WebSdkCallbackUrl
	}
	return client.CallbackUrl
}

func (client *SmileIdClient) hostedLinkCallbackURL() string {
	if client.HostedLinkCallbackUrl != "" {
		return client.HostedLinkCallbackUrl
	}
	return client.CallbackUrl
}

func (client *SmileIdClient) validateCapture(capture SmileIdCaptureRequest) error {
	if client == nil || !smileIdPartnerIdPattern.MatchString(client.PartnerId) || client.ApiKey == "" || client.Http == nil {
		return ErrSmileIdNotConfigured
	}
	if capture.CaseId == "" || capture.Product == "" || capture.Country == "" || capture.DocumentType == "" || capture.ConsentAt.IsZero() {
		return errors.New("smile id: incomplete capture request")
	}
	if err := validateHttpsUrl(capture.PrivacyPolicyUrl); err != nil {
		return fmt.Errorf("smile id: invalid privacy policy URL: %w", err)
	}
	if _, err := smileIdApiOrigin(client.BaseUrl); err != nil {
		return err
	}
	return nil
}

func smileCapturePartnerParams(capture SmileIdCaptureRequest) map[string]string {
	params := map[string]string{"nantty_case_id": capture.CaseId}
	if capture.CaptureAttemptID != "" {
		params["capture_attempt_id"] = capture.CaptureAttemptID
	}
	return params
}

func validateHttpsUrl(value string) error {
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return errors.New("must be an absolute HTTPS URL")
	}
	return nil
}

func (client *SmileIdClient) postV3Multipart(ctx context.Context, path string, fields map[string]string, token string, destination any) error {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for name, value := range fields {
		if err := writeSmileMultipartField(writer, name, value); err != nil {
			return err
		}
	}
	if err := writer.Close(); err != nil {
		return err
	}
	baseUrl, err := smileIdApiOrigin(client.BaseUrl)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, baseUrl+path, &body)
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	if path == "/v3/token" {
		request.Header.Set("smileid-partner-id", client.PartnerId)
		request.Header.Set("smileid-api-key", client.ApiKey)
	} else {
		request.Header.Set("SmileID-Partner-ID", client.PartnerId)
		request.Header.Set("SmileID-Token", token)
	}
	response, err := client.do(request)
	if err != nil {
		return fmt.Errorf("smile id: request %s failed: %w", path, err)
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		return fmt.Errorf("smile id: %s returned status %s", path, strconv.Itoa(response.StatusCode))
	}
	if err := decodeSmileIdPostResponse(response.Body, destination); err != nil {
		return fmt.Errorf("smile id: invalid response from %s: %w", path, err)
	}
	return nil
}

func writeSmileMultipartField(writer *multipart.Writer, name, value string) error {
	if name != "id_types" && name != "partner_params" && name != "payload" {
		return writer.WriteField(name, value)
	}
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="`+name+`"`)
	header.Set("Content-Type", "application/json")
	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	_, err = io.WriteString(part, value)
	return err
}
