package sellerdevelopers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"slices"
	"strings"
	"time"
)

var AllowedApiKeyScopes = []string{
	"products:read", "products:write", "inventory:read", "inventory:write",
	"orders:read", "orders:write", "customers:read", "finance:read",
}

var AllowedWebhookEvents = []string{
	"order.created", "order.updated", "order.delivered", "order.refunded",
	"product.updated", "inventory.low_stock", "payout.paid", "review.created", "message.received",
}

type ApiKeyView struct {
	Id         string     `json:"id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Scopes     []string   `json:"scopes"`
	CreatedBy  string     `json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
}

type WebhookEndpointView struct {
	Id                   string     `json:"id"`
	Url                  string     `json:"url"`
	Description          string     `json:"description"`
	Events               []string   `json:"events"`
	Active               bool       `json:"active"`
	SigningSecretPreview string     `json:"signingSecretPreview"`
	CreatedAt            time.Time  `json:"createdAt"`
	LastDeliveryAt       *time.Time `json:"lastDeliveryAt"`
	RecentFailureCount   int        `json:"recentFailureCount"`
}

type WebhookDeliveryView struct {
	Id                   string    `json:"id"`
	WebhookId            string    `json:"webhookId"`
	Event                string    `json:"event"`
	ResponseStatus       *int      `json:"responseStatus"`
	DurationMilliseconds *int      `json:"durationMilliseconds"`
	Outcome              string    `json:"outcome"`
	AttemptedAt          time.Time `json:"attemptedAt"`
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

func IsSafePublicWebhookUrl(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return false
	}
	if ip := net.ParseIP(host); ip != nil {
		return IsPublicRoutableIP(ip)
	}
	return true
}

func ValidateWebhookDNS(ctx context.Context, rawUrl string) error {
	if !IsSafePublicWebhookUrl(rawUrl) {
		return errors.New("webhook URL must be a public https:// endpoint")
	}
	parsed, _ := url.Parse(strings.TrimSpace(rawUrl))
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", parsed.Hostname())
	if err != nil || len(ips) == 0 {
		return errors.New("webhook hostname did not resolve")
	}
	for _, ip := range ips {
		if !IsPublicRoutableIP(ip) {
			return errors.New("webhook hostname resolves to a non-public IP address")
		}
	}
	return nil
}

func SignWebhookPayload(secret string, unixTimestamp int64, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", unixTimestamp)))
	mac.Write(body)
	return fmt.Sprintf("t=%d,v1=%s", unixTimestamp, hex.EncodeToString(mac.Sum(nil)))
}

func ValidScopes(scopes []string) bool {
	if len(scopes) == 0 {
		return false
	}
	for _, s := range scopes {
		if !slices.Contains(AllowedApiKeyScopes, s) {
			return false
		}
	}
	return true
}

func ValidEvents(events []string) bool {
	if len(events) == 0 {
		return false
	}
	for _, e := range events {
		if !slices.Contains(AllowedWebhookEvents, e) {
			return false
		}
	}
	return true
}
