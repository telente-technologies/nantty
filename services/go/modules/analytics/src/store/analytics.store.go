package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"

	"nantty/modules/analytics/src/types"
)

type Store interface {
	InsertEvents(ctx context.Context, events []types.StoredEvent) (int, int, error)
	CreatorSummary(ctx context.Context, creatorId, window string, since time.Time) (types.CreatorSummary, error)
	SellerSummary(ctx context.Context, storeId, window string, since time.Time) (types.SellerSummary, error)
	PlatformOverview(ctx context.Context, window string, since time.Time) (types.PlatformOverview, error)
	PurgeBefore(ctx context.Context, cutoff time.Time) (int64, error)
}

type PostgresStore struct {
	Database *sql.DB
}

func (store *PostgresStore) InsertEvents(ctx context.Context, events []types.StoredEvent) (int, int, error) {
	accepted, ignored := 0, 0
	for _, event := range events {
		props, err := json.Marshal(event.Properties)
		if err != nil {
			return accepted, ignored, err
		}
		res, err := store.Database.ExecContext(ctx,
			`INSERT INTO analytics_events (id, event_key, domain, event_name, subject_id, actor_id, store_id, amount_minor, currency, anonymized, properties, occurred_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
			 ON CONFLICT (event_key) DO NOTHING`,
			event.Id, event.EventKey, event.Domain, event.EventName, event.SubjectId, event.ActorId, event.StoreId, event.AmountMinor, event.Currency, event.Anonymized, string(props), event.OccurredAt,
		)
		if err != nil {
			return accepted, ignored, err
		}
		rows, _ := res.RowsAffected()
		if rows > 0 {
			accepted++
		} else {
			ignored++
		}
	}
	return accepted, ignored, nil
}

func (store *PostgresStore) CreatorSummary(ctx context.Context, creatorId, window string, since time.Time) (types.CreatorSummary, error) {
	summary := types.CreatorSummary{CreatorId: creatorId, Window: window}
	rows, err := store.Database.QueryContext(ctx,
		`SELECT event_name, COUNT(*)::bigint, COALESCE(SUM(amount_minor), 0)::bigint
		 FROM analytics_events WHERE domain = 'creator' AND subject_id = $1 AND occurred_at >= $2 GROUP BY event_name`,
		creatorId, since,
	)
	if err != nil {
		return summary, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var count, amount int64
		if err := rows.Scan(&name, &count, &amount); err != nil {
			return summary, err
		}
		switch name {
		case "content.viewed":
			summary.Views += count
		case "content.engaged":
			summary.Engagements += count
		case "profile.visited":
			summary.ProfileVisits += count
		case "creator.revenue":
			summary.RevenueMinor += amount
		}
	}
	return summary, rows.Err()
}

func (store *PostgresStore) SellerSummary(ctx context.Context, storeId, window string, since time.Time) (types.SellerSummary, error) {
	summary := types.SellerSummary{StoreId: storeId, Window: window}
	rows, err := store.Database.QueryContext(ctx,
		`SELECT event_name, COUNT(*)::bigint, COALESCE(SUM(amount_minor), 0)::bigint
		 FROM analytics_events WHERE domain = 'commerce' AND store_id = $1 AND occurred_at >= $2 GROUP BY event_name`,
		storeId, since,
	)
	if err != nil {
		return summary, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var count, amount int64
		if err := rows.Scan(&name, &count, &amount); err != nil {
			return summary, err
		}
		switch name {
		case "product.viewed":
			summary.ProductViews += count
		case "cart.added":
			summary.AddToCarts += count
		case "order.completed":
			summary.Orders += count
			summary.GrossSalesMinor += amount
		}
	}
	if summary.ProductViews > 0 {
		summary.ConversionRate = float64(summary.Orders) / float64(summary.ProductViews)
	}
	return summary, rows.Err()
}

func (store *PostgresStore) PlatformOverview(ctx context.Context, window string, since time.Time) (types.PlatformOverview, error) {
	overview := types.PlatformOverview{Window: window, ByDomain: []types.DomainMetric{}}
	rows, err := store.Database.QueryContext(ctx,
		`SELECT domain, event_name, COUNT(*)::bigint, COALESCE(SUM(amount_minor), 0)::bigint
		 FROM analytics_events WHERE occurred_at >= $1 GROUP BY domain, event_name ORDER BY COUNT(*) DESC LIMIT 100`,
		since,
	)
	if err != nil {
		return overview, err
	}
	defer rows.Close()
	for rows.Next() {
		var metric types.DomainMetric
		if err := rows.Scan(&metric.Domain, &metric.EventName, &metric.Count, &metric.AmountMinor); err != nil {
			return overview, err
		}
		overview.TotalEvents += metric.Count
		overview.ByDomain = append(overview.ByDomain, metric)
	}
	return overview, rows.Err()
}

func (store *PostgresStore) PurgeBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := store.Database.ExecContext(ctx, `DELETE FROM analytics_events WHERE occurred_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

type MemoryStore struct {
	mu     sync.RWMutex
	events []types.StoredEvent
	keys   map[string]struct{}
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{keys: map[string]struct{}{}}
}

func (store *MemoryStore) InsertEvents(_ context.Context, events []types.StoredEvent) (int, int, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	accepted, ignored := 0, 0
	for _, event := range events {
		if _, exists := store.keys[event.EventKey]; exists {
			ignored++
			continue
		}
		if event.Id == "" {
			event.Id = uuid.NewString()
		}
		store.keys[event.EventKey] = struct{}{}
		store.events = append(store.events, event)
		accepted++
	}
	return accepted, ignored, nil
}

func (store *MemoryStore) CreatorSummary(_ context.Context, creatorId, window string, since time.Time) (types.CreatorSummary, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	summary := types.CreatorSummary{CreatorId: creatorId, Window: window}
	for _, event := range store.events {
		if event.Domain != "creator" || event.SubjectId != creatorId || event.OccurredAt.Before(since) {
			continue
		}
		switch event.EventName {
		case "content.viewed":
			summary.Views++
		case "content.engaged":
			summary.Engagements++
		case "profile.visited":
			summary.ProfileVisits++
		case "creator.revenue":
			summary.RevenueMinor += event.AmountMinor
		}
	}
	return summary, nil
}

func (store *MemoryStore) SellerSummary(_ context.Context, storeId, window string, since time.Time) (types.SellerSummary, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	summary := types.SellerSummary{StoreId: storeId, Window: window}
	for _, event := range store.events {
		if event.Domain != "commerce" || event.StoreId != storeId || event.OccurredAt.Before(since) {
			continue
		}
		switch event.EventName {
		case "product.viewed":
			summary.ProductViews++
		case "cart.added":
			summary.AddToCarts++
		case "order.completed":
			summary.Orders++
			summary.GrossSalesMinor += event.AmountMinor
		}
	}
	if summary.ProductViews > 0 {
		summary.ConversionRate = float64(summary.Orders) / float64(summary.ProductViews)
	}
	return summary, nil
}

func (store *MemoryStore) PlatformOverview(_ context.Context, window string, since time.Time) (types.PlatformOverview, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	overview := types.PlatformOverview{Window: window, ByDomain: []types.DomainMetric{}}
	counts := map[string]*types.DomainMetric{}
	for _, event := range store.events {
		if event.OccurredAt.Before(since) {
			continue
		}
		key := event.Domain + ":" + event.EventName
		metric, exists := counts[key]
		if !exists {
			metric = &types.DomainMetric{Domain: event.Domain, EventName: event.EventName}
			counts[key] = metric
		}
		metric.Count++
		metric.AmountMinor += event.AmountMinor
		overview.TotalEvents++
	}
	for _, metric := range counts {
		overview.ByDomain = append(overview.ByDomain, *metric)
	}
	return overview, nil
}

func (store *MemoryStore) PurgeBefore(_ context.Context, cutoff time.Time) (int64, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	kept := make([]types.StoredEvent, 0, len(store.events))
	var removed int64
	for _, event := range store.events {
		if event.OccurredAt.Before(cutoff) {
			delete(store.keys, event.EventKey)
			removed++
			continue
		}
		kept = append(kept, event)
	}
	store.events = kept
	return removed, nil
}
