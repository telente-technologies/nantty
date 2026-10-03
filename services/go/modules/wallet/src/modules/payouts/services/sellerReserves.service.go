package services

import (
	"context"
	"net/http"
	"time"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/loaders"
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/sellerreserveflag"
	"zudomart/platform/httpserver"
)

var ErrReserveFlagNotFound = httpserver.NewApiError(http.StatusNotFound, "SELLER_RESERVE_NOT_FOUND", "This seller has no active reserve.")

type SellerReserves struct {
	Container *container.Container
}

type SellerReserveView struct {
	SellerUserId string     `json:"sellerUserId"`
	ReserveBps   int64      `json:"reserveBps"`
	HoldDays     int        `json:"holdDays"`
	Reason       string     `json:"reason"`
	FlaggedBy    string     `json:"flaggedBy"`
	CreatedAt    time.Time  `json:"createdAt"`
	ReleasedAt   *time.Time `json:"releasedAt"`
}

func (reserves SellerReserves) PolicyFor(ctx context.Context, executor databases.ExecutorQuerier, sellerUserId string) (sellerbalances.SellerReserveTerms, error) {
	flag, err := reserves.Container.Client(executor).SellerReserveFlag.Query().Where(sellerreserveflag.SellerUserID(sellerUserId), sellerreserveflag.ReleasedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return sellerbalances.SellerReserveTerms{}, nil
	}
	if err != nil {
		return sellerbalances.SellerReserveTerms{}, err
	}
	bps := flag.ReserveBps
	if bps == 0 {
		bps = reserves.Container.Resources.Platform.ReadEscrowPolicy(ctx, loaders.EscrowPolicy{}).SellerReserveBps
	}
	holdDays := flag.HoldDays
	if holdDays <= 0 {
		holdDays = reserves.Container.Settings.SellerReserveHoldDays
	}
	return sellerbalances.SellerReserveTerms{ReserveBps: bps, HoldFor: time.Duration(holdDays) * 24 * time.Hour}, nil
}

func (reserves SellerReserves) FlagSeller(ctx context.Context, staffId, sellerUserId, reason string, reserveBps int64, holdDays int) (SellerReserveView, error) {
	client := reserves.Container.Client(reserves.Container.Resources.Database)
	if err := client.SellerReserveFlag.Update().Where(sellerreserveflag.SellerUserID(sellerUserId), sellerreserveflag.ReleasedAtIsNil()).
		SetReleasedAt(reserves.Container.Now().UTC()).SetReleasedByStaffID(staffId).Exec(ctx); err != nil {
		return SellerReserveView{}, err
	}
	created, err := client.SellerReserveFlag.Create().SetSellerUserID(sellerUserId).SetReserveBps(reserveBps).SetHoldDays(holdDays).SetReason(reason).
		SetFlaggedByStaffID(staffId).SetCreatedAt(reserves.Container.Now()).Save(ctx)
	if err != nil {
		return SellerReserveView{}, err
	}
	return convertSellerReserve(created), nil
}

func (reserves SellerReserves) ReleaseSeller(ctx context.Context, staffId, sellerUserId string) error {
	updated, err := reserves.Container.Client(reserves.Container.Resources.Database).SellerReserveFlag.Update().
		Where(sellerreserveflag.SellerUserID(sellerUserId), sellerreserveflag.ReleasedAtIsNil()).SetReleasedAt(reserves.Container.Now().UTC()).SetReleasedByStaffID(staffId).Save(ctx)
	if err == nil && updated == 0 {
		return ErrReserveFlagNotFound
	}
	return err
}

func (reserves SellerReserves) ListActive(ctx context.Context, limit int) ([]SellerReserveView, error) {
	rows, err := reserves.Container.Client(reserves.Container.Resources.Database).SellerReserveFlag.Query().Where(sellerreserveflag.ReleasedAtIsNil()).
		Order(ent.Desc(sellerreserveflag.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]SellerReserveView, 0, len(rows))
	for _, row := range rows {
		views = append(views, convertSellerReserve(row))
	}
	return views, nil
}

func convertSellerReserve(row *ent.SellerReserveFlag) SellerReserveView {
	return SellerReserveView{SellerUserId: row.SellerUserID, ReserveBps: row.ReserveBps, HoldDays: row.HoldDays, Reason: row.Reason, FlaggedBy: row.FlaggedByStaffID, CreatedAt: row.CreatedAt, ReleasedAt: row.ReleasedAt}
}
