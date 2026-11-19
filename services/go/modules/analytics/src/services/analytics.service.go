package services

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/analytics/src/store"
	"nantty/modules/analytics/src/types"
	"nantty/platform/httpserver"
)

var allowedDomains = map[string]bool{"commerce": true, "creator": true, "social": true, "live": true, "ads": true, "developer": true}
var allowedClientEvents = map[string]bool{
	"content.viewed":  true,
	"content.engaged": true,
	"profile.visited": true,
	"product.viewed":  true,
	"cart.added":      true,
	"ad.viewed":       true,
	"ad.clicked":      true,
}
var eventNamePattern = regexp.MustCompile(`^[a-z0-9]+(\.[a-z0-9_]+)+$`)

type Service struct {
	Store        store.Store
	Now          func() time.Time
	MaxBatchSize int
}

func (service Service) IngestBatch(ctx context.Context, actorId, ageBracket string, inputs []types.IngestEventInput) (types.IngestBatchResult, error) {
	return service.ingest(ctx, actorId, ageBracket, inputs, false)
}

func (service Service) IngestInternalBatch(ctx context.Context, inputs []types.IngestEventInput) (types.IngestBatchResult, error) {
	return service.ingest(ctx, "", "adult", inputs, true)
}

func (service Service) ingest(ctx context.Context, actorId, ageBracket string, inputs []types.IngestEventInput, trustedInternal bool) (types.IngestBatchResult, error) {
	if len(inputs) == 0 || len(inputs) > service.maxBatch() {
		return types.IngestBatchResult{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_BATCH_SIZE", "Provide between 1 and 50 analytics events.")
	}
	now := service.now()
	anonymize := !trustedInternal && ageBracket != "adult"
	stored := make([]types.StoredEvent, 0, len(inputs))
	for _, item := range inputs {
		domain := strings.TrimSpace(strings.ToLower(item.Domain))
		name := strings.TrimSpace(strings.ToLower(item.EventName))
		if !allowedDomains[domain] || !eventNamePattern.MatchString(name) {
			return types.IngestBatchResult{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_ANALYTICS_EVENT", "Unsupported analytics event domain or name.")
		}
		if item.AmountMinor < 0 {
			return types.IngestBatchResult{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_AMOUNT", "Amount must not be negative.")
		}
		if !trustedInternal {
			if !allowedClientEvents[name] || item.AmountMinor > 0 {
				return types.IngestBatchResult{}, httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN_ANALYTICS_EVENT", "Monetary and authoritative order/revenue events cannot be submitted from client telemetry.")
			}
		}
		occurredAt := now
		if item.OccurredAt != nil && !item.OccurredAt.IsZero() {
			occurredAt = item.OccurredAt.UTC()
		}
		eventKey := strings.TrimSpace(item.EventKey)
		if eventKey == "" {
			eventKey = uuid.NewString()
		}
		props := sanitizeProperties(item.Properties, anonymize)
		effectiveActor := actorId
		if anonymize {
			effectiveActor = ""
		}
		stored = append(stored, types.StoredEvent{
			Id: uuid.NewString(), EventKey: eventKey, Domain: domain, EventName: name,
			SubjectId: strings.TrimSpace(item.SubjectId), ActorId: effectiveActor, StoreId: strings.TrimSpace(item.StoreId),
			AmountMinor: item.AmountMinor, Currency: strings.ToUpper(strings.TrimSpace(item.Currency)),
			Anonymized: anonymize, Properties: props, OccurredAt: occurredAt,
		})
	}
	accepted, ignored, err := service.Store.InsertEvents(ctx, stored)
	if err != nil {
		return types.IngestBatchResult{}, err
	}
	return types.IngestBatchResult{Accepted: accepted, Ignored: ignored}, nil
}

func (service Service) CreatorSummary(ctx context.Context, creatorId, window string) (types.CreatorSummary, error) {
	norm, since := resolveWindow(service.now(), window)
	return service.Store.CreatorSummary(ctx, creatorId, norm, since)
}

func (service Service) SellerSummary(ctx context.Context, storeId, window string) (types.SellerSummary, error) {
	if strings.TrimSpace(storeId) == "" {
		return types.SellerSummary{}, httpserver.NewApiError(http.StatusBadRequest, "STORE_ID_REQUIRED", "Specify a storeId query parameter.")
	}
	norm, since := resolveWindow(service.now(), window)
	return service.Store.SellerSummary(ctx, strings.TrimSpace(storeId), norm, since)
}

func (service Service) PlatformOverview(ctx context.Context, window string) (types.PlatformOverview, error) {
	norm, since := resolveWindow(service.now(), window)
	return service.Store.PlatformOverview(ctx, norm, since)
}

func (service Service) maxBatch() int {
	if service.MaxBatchSize > 0 {
		return service.MaxBatchSize
	}
	return 50
}

func (service Service) now() time.Time {
	if service.Now != nil {
		return service.Now().UTC()
	}
	return time.Now().UTC()
}

func resolveWindow(now time.Time, raw string) (string, time.Time) {
	switch strings.TrimSpace(strings.ToLower(raw)) {
	case "7d":
		return "7d", now.AddDate(0, 0, -7)
	case "90d":
		return "90d", now.AddDate(0, 0, -90)
	default:
		return "30d", now.AddDate(0, 0, -30)
	}
}

func sanitizeProperties(raw map[string]any, anonymize bool) map[string]any {
	clean := map[string]any{}
	for key, val := range raw {
		lower := strings.ToLower(strings.TrimSpace(key))
		if lower == "" || len(lower) > 64 {
			continue
		}
		if anonymize && (strings.Contains(lower, "user") || strings.Contains(lower, "device") || strings.Contains(lower, "ip") || strings.Contains(lower, "email")) {
			continue
		}
		clean[key] = val
	}
	return clean
}
