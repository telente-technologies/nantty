package integrations

import (
	"context"
	"net/http"
	"net/url"
	"sync"
	"time"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/interfaces"
)

const FullAdLoadPercent = 100

func (gateway HttpMoneyAccountGateway) AdLoadPercent(ctx context.Context, userId string) (int, error) {
	var entitlements struct {
		Premium       *bool `json:"premium"`
		AdLoadPercent *int  `json:"adLoadPercent"`
	}
	if err := gateway.send(ctx, http.MethodGet, "/api/v1/internal/entitlements/"+url.PathEscape(userId), "", nil, &entitlements); err != nil {
		return FullAdLoadPercent, err
	}
	if entitlements.Premium != nil && *entitlements.Premium {
		return 0, nil
	}
	if entitlements.AdLoadPercent == nil {
		if entitlements.Premium == nil {
			return FullAdLoadPercent, adserrors.UpstreamUnavailable
		}
		return FullAdLoadPercent, nil
	}
	return min(max(*entitlements.AdLoadPercent, 0), FullAdLoadPercent), nil
}

func (UnconfiguredMoneyAccountGateway) AdLoadPercent(context.Context, string) (int, error) {
	return FullAdLoadPercent, adserrors.UpstreamUnavailable
}

func (reader StaticEntitlementReader) AdLoadPercent(_ context.Context, userId string) (int, error) {
	if reader.Premium[userId] {
		return 0, nil
	}
	if percent, known := reader.AdLoad[userId]; known {
		return percent, nil
	}
	return FullAdLoadPercent, nil
}

type PremiumOnlyAdLoadReader struct{ Entitlements interfaces.EntitlementReader }

func (reader PremiumOnlyAdLoadReader) AdLoadPercent(ctx context.Context, userId string) (int, error) {
	if reader.Entitlements == nil {
		return FullAdLoadPercent, nil
	}
	premium, err := reader.Entitlements.IsPremium(ctx, userId)
	if premium {
		return 0, err
	}
	return FullAdLoadPercent, err
}

type cachedAdLoad struct {
	percent   int
	expiresAt time.Time
}

type CachedAdLoadReader struct {
	upstream   interfaces.AdLoadReader
	timeToLive time.Duration
	now        func() time.Time
	mutex      sync.Mutex
	entries    map[string]cachedAdLoad
}

func NewCachedAdLoadReader(upstream interfaces.AdLoadReader, timeToLive time.Duration, now func() time.Time) *CachedAdLoadReader {
	if now == nil {
		now = time.Now
	}
	return &CachedAdLoadReader{upstream: upstream, timeToLive: timeToLive, now: now, entries: map[string]cachedAdLoad{}}
}

func (reader *CachedAdLoadReader) AdLoadPercent(ctx context.Context, userId string) (int, error) {
	now := reader.now()
	reader.mutex.Lock()
	entry, found := reader.entries[userId]
	reader.mutex.Unlock()
	if found && now.Before(entry.expiresAt) {
		return entry.percent, nil
	}
	percent, err := reader.upstream.AdLoadPercent(ctx, userId)
	if err != nil {
		return percent, err
	}
	reader.mutex.Lock()
	defer reader.mutex.Unlock()
	if len(reader.entries) > 100_000 {
		reader.entries = map[string]cachedAdLoad{}
	}
	reader.entries[userId] = cachedAdLoad{percent: percent, expiresAt: now.Add(reader.timeToLive)}
	return percent, nil
}
