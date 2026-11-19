package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/logistics"
)

var ErrQuoteAlreadyUsed = errors.New("delivery quote is no longer available")
var ErrShipmentAlreadyReserved = errors.New("order already has a partner shipment")

func (store PartnerLogisticsStore) ReserveShipment(ctx context.Context, rec ShipmentRecord, quote QuoteRecord, parcel logistics.Parcel) error {
	tx, err := store.Database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().UTC()
	updated, err := tx.ExecContext(ctx,
		`UPDATE delivery_quotes SET status = 'booking_pending', order_group_id = COALESCE(order_group_id, $1), updated_at = $2
		 WHERE id = $3 AND store_id = $4 AND status = 'quoted' AND (order_group_id IS NULL OR order_group_id = $1) AND expires_at > $2`,
		rec.OrderGroupId, now, quote.Id, rec.StoreId,
	)
	if err != nil {
		return err
	}
	if count, err := updated.RowsAffected(); err != nil || count != 1 {
		if err != nil {
			return err
		}
		return ErrQuoteAlreadyUsed
	}
	pickupJSON, err := json.Marshal(quote.Pickup)
	if err != nil {
		return err
	}
	destJSON, err := json.Marshal(quote.Destination)
	if err != nil {
		return err
	}
	inserted, err := tx.ExecContext(ctx,
		`INSERT INTO shipments (id, created_at, order_group_id, store_id, provider, quote_id, status, service_type, pickup_address, destination_address, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, 'booking_pending', $7, $8::jsonb, $9::jsonb, $2)
		 ON CONFLICT (order_group_id) DO NOTHING`,
		rec.Id, now, rec.OrderGroupId, rec.StoreId, rec.Provider, quote.Id, logistics.ServiceTypeDoorToDoor, string(pickupJSON), string(destJSON),
	)
	if err != nil {
		return err
	}
	if count, err := inserted.RowsAffected(); err != nil || count != 1 {
		if err != nil {
			return err
		}
		return ErrShipmentAlreadyReserved
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO parcels (id, created_at, shipment_id, weight_grams, package_count, contents_description, declared_value_minor, currency, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $2)`,
		uuid.New(), now, rec.Id, parcel.WeightGrams, max(parcel.PackageCount, 1), parcel.ContentsDescription, parcel.DeclaredValueMinor, parcel.Currency,
	); err != nil {
		return err
	}
	return tx.Commit()
}

func (store PartnerLogisticsStore) CompleteShipmentBooking(ctx context.Context, rec ShipmentRecord, quoteId uuid.UUID) error {
	tx, err := store.Database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().UTC()
	updated, err := tx.ExecContext(ctx,
		`UPDATE shipments SET provider_reference = $2, status = $3, tracking_number = NULLIF($4, ''), booked_at = $5, estimated_delivery_at = $6, updated_at = $7
		 WHERE id = $1 AND store_id = $8 AND status = 'booking_pending'`,
		rec.Id, rec.ProviderReference, rec.Status, rec.TrackingNumber, rec.BookedAt, rec.EstimatedAt, now, rec.StoreId,
	)
	if err != nil {
		return err
	}
	if count, err := updated.RowsAffected(); err != nil || count != 1 {
		if err != nil {
			return err
		}
		return ErrShipmentAlreadyReserved
	}
	quoteUpdate, err := tx.ExecContext(ctx,
		`UPDATE delivery_quotes SET status = 'booked', updated_at = $2 WHERE id = $1 AND store_id = $3 AND status = 'booking_pending'`,
		quoteId, now, rec.StoreId,
	)
	if err != nil {
		return err
	}
	if count, err := quoteUpdate.RowsAffected(); err != nil || count != 1 {
		if err != nil {
			return err
		}
		return ErrQuoteAlreadyUsed
	}
	return tx.Commit()
}

func (store PartnerLogisticsStore) MarkShipmentBookingUnknown(ctx context.Context, storeId, shipmentId uuid.UUID) error {
	_, err := store.Database.ExecContext(ctx,
		`UPDATE shipments SET status = 'booking_unknown', updated_at = now() WHERE id = $1 AND store_id = $2 AND status = 'booking_pending'`,
		shipmentId, storeId,
	)
	return err
}
