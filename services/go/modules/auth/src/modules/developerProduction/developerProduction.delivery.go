package developerproduction

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

const maxWebhookDeliveryAttempts = 5

func resolveWebhookCipherKey() ([]byte, error) {
	raw := strings.TrimSpace(os.Getenv("DEVELOPER_WEBHOOK_ENCRYPTION_KEY"))
	if raw == "" {
		env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
		if env == "" {
			env = strings.ToLower(strings.TrimSpace(os.Getenv("NANTTY_ENV")))
		}
		if env == "production" {
			return nil, errors.New("DEVELOPER_WEBHOOK_ENCRYPTION_KEY is required in production")
		}
		sum := sha256.Sum256([]byte("nantty-dev-webhook-key-not-for-production"))
		return sum[:], nil
	}
	sum := sha256.Sum256([]byte(raw))
	return sum[:], nil
}

func SealWebhookSecret(secret string) (string, error) {
	key, err := resolveWebhookCipherKey()
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(secret), nil)
	return base64.RawStdEncoding.EncodeToString(sealed), nil
}

func OpenWebhookSecret(ciphertext string) (string, error) {
	key, err := resolveWebhookCipherKey()
	if err != nil {
		return "", err
	}
	raw, err := base64.RawStdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("invalid webhook secret ciphertext")
	}
	plain, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func IsPublicRoutableIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	if addr.IsLoopback() || addr.IsPrivate() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsMulticast() || addr.IsUnspecified() {
		return false
	}
	cgnat := netip.MustParsePrefix("100.64.0.0/10")
	if cgnat.Contains(addr) {
		return false
	}
	return addr.IsGlobalUnicast()
}

func ValidateWebhookDNS(ctx context.Context, rawUrl string) error {
	if !IsSafePublicHttpsUrl(rawUrl) {
		return httpserver.NewApiError(http.StatusBadRequest, "INVALID_WEBHOOK_URL", "Webhook URL must be a public https:// endpoint.")
	}
	parsed, _ := url.Parse(strings.TrimSpace(rawUrl))
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", parsed.Hostname())
	if err != nil || len(ips) == 0 {
		return httpserver.NewApiError(http.StatusBadRequest, "WEBHOOK_DNS_FAILED", "Webhook hostname did not resolve.")
	}
	for _, ip := range ips {
		if !IsPublicRoutableIP(ip) {
			return httpserver.NewApiError(http.StatusBadRequest, "INVALID_WEBHOOK_IP", "Webhook resolves to a non-public IP address.")
		}
	}
	return nil
}

func NewSsrfSafeHttpClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{
		Timeout: 5 * time.Second,
		Control: func(_, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			ip := net.ParseIP(host)
			if !IsPublicRoutableIP(ip) {
				return errors.New("blocked non-public webhook destination IP")
			}
			return nil
		},
	}
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext:         dialer.DialContext,
			TLSHandshakeTimeout: 5 * time.Second,
		},
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func SignWebhookHeader(secret string, ts int64, rawBody []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strconv.FormatInt(ts, 10)))
	mac.Write([]byte("."))
	mac.Write(rawBody)
	return fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil)))
}

func (controller Controller) VerifyWebhook(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "webhooks.manage", true)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	whId, err := uuid.Parse(request.PathValue("webhookID"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_WEBHOOK_ID", "Invalid webhook ID."))
		return
	}
	var targetUrl, ciphertext string
	err = controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT url, COALESCE(signing_secret_ciphertext, '') FROM developer_production_webhooks WHERE id = $1 AND organization_id = $2 AND application_id = $3`,
		whId, orgUUID, appUUID,
	).Scan(&targetUrl, &ciphertext)
	if err == sql.ErrNoRows {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if err := ValidateWebhookDNS(request.Context(), targetUrl); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	secret, err := OpenWebhookSecret(ciphertext)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "WEBHOOK_SECRET_ROTATION_REQUIRED", "Rotate this webhook's signing secret before verifying."))
		return
	}
	challengeBytes := make([]byte, 16)
	_, _ = rand.Read(challengeBytes)
	challenge := hex.EncodeToString(challengeBytes)
	eventId := uuid.NewString()
	now := controller.Container.Now().UTC()
	payload, _ := json.Marshal(map[string]any{
		"id": eventId, "event": "webhook.verification", "createdAt": now.Format(time.RFC3339),
		"data": map[string]any{"challenge": challenge},
	})
	req, _ := http.NewRequestWithContext(request.Context(), http.MethodPost, targetUrl, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("nantty-event-id", eventId)
	req.Header.Set("nantty-signature", SignWebhookHeader(secret, now.Unix(), payload))
	resp, err := NewSsrfSafeHttpClient(8 * time.Second).Do(req)
	if err != nil {
		_, _ = controller.Container.Database.ExecContext(request.Context(), `UPDATE developer_production_webhooks SET last_error = $1, updated_at = $2 WHERE id = $3`, err.Error(), now, whId)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadGateway, "WEBHOOK_VERIFICATION_FAILED", "Endpoint did not respond to verification challenge."))
		return
	}
	defer resp.Body.Close()
	bodyRaw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	var ack struct {
		Challenge string `json:"challenge"`
	}
	_ = json.Unmarshal(bodyRaw, &ack)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || ack.Challenge != challenge {
		_, _ = controller.Container.Database.ExecContext(request.Context(), `UPDATE developer_production_webhooks SET last_error = $1, updated_at = $2 WHERE id = $3`, fmt.Sprintf("status=%d challenge_mismatch", resp.StatusCode), now, whId)
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadGateway, "WEBHOOK_CHALLENGE_MISMATCH", "Endpoint must return 2xx with JSON {\"challenge\": \"...\"}."))
		return
	}
	_, _ = controller.Container.Database.ExecContext(request.Context(), `UPDATE developer_production_webhooks SET verified_at = $1, last_error = NULL, updated_at = $1 WHERE id = $2`, now, whId)
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"verified": true, "verifiedAt": now})
}

func (controller Controller) RotateWebhookSecret(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	orgUUID, appUUID, _, err := controller.store().RequireMemberAndApprovedApp(request.Context(), principal.UserId, request.PathValue("organizationID"), request.PathValue("applicationID"), "webhooks.manage", true)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	whId, err := uuid.Parse(request.PathValue("webhookID"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "INVALID_WEBHOOK_ID", "Invalid webhook ID."))
		return
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	secret := "whsec_" + hex.EncodeToString(raw)
	ciphertext, err := SealWebhookSecret(secret)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	preview := "whsec_••••" + secret[len(secret)-4:]
	now := controller.Container.Now().UTC()
	res, err := controller.Container.Database.ExecContext(request.Context(),
		`UPDATE developer_production_webhooks SET signing_secret_preview = $1, signing_secret_hash = $2, signing_secret_ciphertext = $3, updated_at = $4
		 WHERE id = $5 AND organization_id = $6 AND application_id = $7`,
		preview, Sha256Hex(secret), ciphertext, now, whId, orgUUID, appUUID,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"signingSecret": secret, "signingSecretPreview": preview})
}
