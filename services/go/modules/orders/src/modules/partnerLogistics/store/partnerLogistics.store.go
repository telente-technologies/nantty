package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/logistics"
)

type QuoteRecord struct {
	Id              uuid.UUID
	StoreId         uuid.UUID
	OrderGroupId    *uuid.UUID
	Provider        string
	ProviderQuoteId string
	Status          string
	AmountMinor     int64
	Currency        string
	ExpiresAt       time.Time
	Pickup          logistics.Address
	Destination     logistics.Address
}

type OrderGroupSummary struct {
	Id            uuid.UUID
	StoreId       uuid.UUID
	Status        string
	PaymentStatus string
	Currency      string
	SubtotalMinor int64
	TotalMinor    int64
}

type ShipmentRecord struct {
	Id                uuid.UUID
	OrderGroupId      uuid.UUID
	StoreId           uuid.UUID
	Provider          string
	ProviderReference string
	Status            string
	TrackingNumber    string
	BookedAt          *time.Time
	EstimatedAt       *time.Time
}

type ShipmentEventRecord struct {
	Id         string    `json:"id"`
	Kind       string    `json:"kind"`
	Status     string    `json:"status"`
	Source     string    `json:"source"`
	OccurredAt time.Time `json:"occurredAt"`
}

type PartnerLogisticsStore struct {
	Database *sql.DB
}

func (store PartnerLogisticsStore) HasConsent(ctx context.Context, storeId uuid.UUID) (bool, error) {
	var active bool
	err := store.Database.QueryRowContext(ctx,
		`SELECT active FROM delivery_policies WHERE store_id = $1`, storeId,
	).Scan(&active)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return active, err
}

func (store PartnerLogisticsStore) SaveConsent(ctx context.Context, storeId uuid.UUID, active bool) error {
	now := time.Now().UTC()
	_, err := store.Database.ExecContext(ctx,
		`INSERT INTO delivery_policies (id, created_at, store_id, active, funding_party, updated_at)
		 VALUES ($1, $2, $3, $4, 'seller', $2)
		 ON CONFLICT (store_id) DO UPDATE SET active = EXCLUDED.active, updated_at = EXCLUDED.updated_at`,
		uuid.New(), now, storeId, active,
	)
	return err
}

func (store PartnerLogisticsStore) FindOrderGroupForBooking(ctx context.Context, storeId, orderGroupId uuid.UUID) (OrderGroupSummary, bool, error) {
	var summary OrderGroupSummary
	err := store.Database.QueryRowContext(ctx,
		`SELECT id, store_id, status, payment_status, currency, subtotal_minor, total_minor
		 FROM order_groups WHERE id = $1 AND store_id = $2`,
		orderGroupId, storeId,
	).Scan(&summary.Id, &summary.StoreId, &summary.Status, &summary.PaymentStatus, &summary.Currency, &summary.SubtotalMinor, &summary.TotalMinor)
	if err == sql.ErrNoRows {
		return OrderGroupSummary{}, false, nil
	}
	return summary, err == nil, err
}

func (store PartnerLogisticsStore) HasActiveShipmentForOrder(ctx context.Context, storeId, orderGroupId uuid.UUID) (bool, error) {
	var exists bool
	err := store.Database.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM shipments WHERE store_id = $1 AND order_group_id = $2 AND status <> 'cancelled')`,
		storeId, orderGroupId,
	).Scan(&exists)
	return exists, err
}

func (store PartnerLogisticsStore) HasProviderShipment(ctx context.Context, storeId uuid.UUID, provider, reference string) (bool, error) {
	var found bool
	err := store.Database.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM shipments WHERE store_id = $1 AND provider = $2 AND provider_reference = $3)`,
		storeId, provider, reference,
	).Scan(&found)
	return found, err
}

func (store PartnerLogisticsStore) FindShipmentByProviderReference(ctx context.Context, storeId uuid.UUID, provider, providerRef string) (ShipmentRecord, bool, error) {
	var rec ShipmentRecord
	err := store.Database.QueryRowContext(ctx,
		`SELECT id, order_group_id, store_id, provider, COALESCE(provider_reference, ''), status, COALESCE(tracking_number, ''), booked_at, estimated_delivery_at
		 FROM shipments WHERE store_id = $1 AND provider = $2 AND provider_reference = $3`,
		storeId, provider, providerRef,
	).Scan(&rec.Id, &rec.OrderGroupId, &rec.StoreId, &rec.Provider, &rec.ProviderReference, &rec.Status, &rec.TrackingNumber, &rec.BookedAt, &rec.EstimatedAt)
	if err == sql.ErrNoRows {
		return ShipmentRecord{}, false, nil
	}
	return rec, err == nil, err
}

func (store PartnerLogisticsStore) MarkShipmentCancelled(ctx context.Context, storeId, shipmentId uuid.UUID) error {
	now := time.Now().UTC()
	_, err := store.Database.ExecContext(ctx,
		`UPDATE shipments SET previous_status = status, status = 'cancelled', cancelled_at = COALESCE(cancelled_at, $1), updated_at = $1
		 WHERE id = $2 AND store_id = $3`,
		now, shipmentId, storeId,
	)
	return err
}

func (store PartnerLogisticsStore) SaveQuote(ctx context.Context, record QuoteRecord) error {
	now := time.Now().UTC()
	route, err := json.Marshal(map[string]any{"pickup": record.Pickup, "destination": record.Destination})
	if err != nil {
		return err
	}
	_, err = store.Database.ExecContext(ctx,
		`INSERT INTO delivery_quotes (id, created_at, store_id, order_group_id, provider, provider_quote_id, service_type, status, amount_minor, currency, route, expires_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'quoted', $8, $9, $10::jsonb, $11, $2)`,
		record.Id, now, record.StoreId, record.OrderGroupId, record.Provider, record.ProviderQuoteId, logistics.ServiceTypeDoorToDoor,
		record.AmountMinor, record.Currency, string(route), record.ExpiresAt,
	)
	return err
}

func (store PartnerLogisticsStore) FindQuote(ctx context.Context, storeId, quoteId uuid.UUID) (QuoteRecord, bool, error) {
	var rec QuoteRecord
	var routeRaw []byte
	err := store.Database.QueryRowContext(ctx,
		`SELECT id, store_id, order_group_id, provider, COALESCE(provider_quote_id, ''), status, amount_minor, currency, expires_at, route
		 FROM delivery_quotes WHERE id = $1 AND store_id = $2`, quoteId, storeId,
	).Scan(&rec.Id, &rec.StoreId, &rec.OrderGroupId, &rec.Provider, &rec.ProviderQuoteId, &rec.Status, &rec.AmountMinor, &rec.Currency, &rec.ExpiresAt, &routeRaw)
	if err == sql.ErrNoRows {
		return QuoteRecord{}, false, nil
	}
	if err != nil {
		return QuoteRecord{}, false, err
	}
	var route struct {
		Pickup      logistics.Address `json:"pickup"`
		Destination logistics.Address `json:"destination"`
	}
	_ = json.Unmarshal(routeRaw, &route)
	rec.Pickup, rec.Destination = route.Pickup, route.Destination
	return rec, true, nil
}

func (store PartnerLogisticsStore) RecordWebhookEvent(ctx context.Context, provider string, ev logistics.WebhookEvent) (ShipmentRecord, bool, error) {
	var rec ShipmentRecord
	trackingId, _ := ev.Payload["trackingId"].(string)
	err := store.Database.QueryRowContext(ctx,
		`SELECT id, order_group_id, store_id, provider, COALESCE(provider_reference, ''), status, COALESCE(tracking_number, '')
		 FROM shipments WHERE provider = $1 AND (provider_reference = $2 OR ($3 <> '' AND tracking_number = $3))`,
		provider, ev.ProviderReference, trackingId,
	).Scan(&rec.Id, &rec.OrderGroupId, &rec.StoreId, &rec.Provider, &rec.ProviderReference, &rec.Status, &rec.TrackingNumber)
	if err == sql.ErrNoRows {
		return ShipmentRecord{}, false, nil
	}
	if err != nil {
		return ShipmentRecord{}, false, err
	}
	payloadJSON, _ := json.Marshal(ev.Payload)
	now := time.Now().UTC()
	res, err := store.Database.ExecContext(ctx,
		`INSERT INTO shipment_events (id, created_at, shipment_id, provider, provider_event_id, kind, status, source, payload, occurred_at, received_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'webhook', $8::jsonb, $9, $2)
		 ON CONFLICT (provider, provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING`,
		uuid.New(), now, rec.Id, provider, nullableString(ev.ProviderEventId), ev.Kind, ev.Status, string(payloadJSON), ev.OccurredAt,
	)
	if err != nil {
		return ShipmentRecord{}, false, err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return rec, false, nil
	}
	_, err = store.Database.ExecContext(ctx,
		`UPDATE shipments SET previous_status = status, status = $1, updated_at = $2,
		 picked_up_at = COALESCE(picked_up_at, CASE WHEN $1 = 'picked_up' THEN $3 ELSE NULL END),
		 delivered_at = COALESCE(delivered_at, CASE WHEN $1 = 'delivered' THEN $3 ELSE NULL END),
		 cancelled_at = COALESCE(cancelled_at, CASE WHEN $1 = 'cancelled' THEN $3 ELSE NULL END)
		 WHERE id = $4`,
		ev.Status, now, ev.OccurredAt, rec.Id,
	)
	rec.Status = ev.Status
	return rec, true, err
}

func (store PartnerLogisticsStore) FindShipmentAndEvents(ctx context.Context, storeId, shipmentId uuid.UUID) (ShipmentRecord, []ShipmentEventRecord, bool, error) {
	var rec ShipmentRecord
	err := store.Database.QueryRowContext(ctx,
		`SELECT id, order_group_id, store_id, provider, COALESCE(provider_reference, ''), status, COALESCE(tracking_number, ''), booked_at, estimated_delivery_at
		 FROM shipments WHERE id = $1 AND store_id = $2`, shipmentId, storeId,
	).Scan(&rec.Id, &rec.OrderGroupId, &rec.StoreId, &rec.Provider, &rec.ProviderReference, &rec.Status, &rec.TrackingNumber, &rec.BookedAt, &rec.EstimatedAt)
	if err == sql.ErrNoRows {
		return ShipmentRecord{}, nil, false, nil
	}
	if err != nil {
		return ShipmentRecord{}, nil, false, err
	}
	rows, err := store.Database.QueryContext(ctx,
		`SELECT id::text, kind, status, source, occurred_at FROM shipment_events WHERE shipment_id = $1 ORDER BY occurred_at ASC`, shipmentId,
	)
	if err != nil {
		return rec, nil, true, err
	}
	defer rows.Close()
	events := []ShipmentEventRecord{}
	for rows.Next() {
		var ev ShipmentEventRecord
		if err := rows.Scan(&ev.Id, &ev.Kind, &ev.Status, &ev.Source, &ev.OccurredAt); err != nil {
			return rec, nil, true, err
		}
		events = append(events, ev)
	}
	return rec, events, true, rows.Err()
}

func nullableString(val string) any {
	if val == "" {
		return nil
	}
	return val
}
