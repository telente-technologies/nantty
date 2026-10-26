package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	escrowent "nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/ledger/src/databases"
	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/platform/usersdirectory"
)

type SellerEscrows struct {
	Container *container.Container
}

func (escrows SellerEscrows) client() *escrowent.Client {
	schema := escrows.Container.Settings.EscrowSchema
	return escrowent.NewClient(escrowent.Driver(databases.EntDriverForExecutor(escrows.Container.Resources.Database)),
		escrowent.AlternateSchema(escrowent.SchemaConfig{Escrow: schema, EscrowEvent: schema, Dispute: schema, DisputeMessage: schema, DisputeStatusEvent: schema, IdempotentRequest: schema, OutboxEvent: schema}))
}

func (escrows SellerEscrows) Query(seller dtos.SellerContext) *escrowent.EscrowQuery {
	return escrows.client().Escrow.Query().Where(escrow.StoreID(seller.StoreId.String()), escrow.SellerUserID(seller.SellerId), escrow.Currency(seller.Currency), escrow.PaymentModeEQ(escrow.PaymentModeEscrow))
}

func DashboardEscrowStatus(row *escrowent.Escrow) string {
	switch row.Status {
	case escrow.StatusHeld:
		return "held"
	case escrow.StatusDisputed:
		return "disputed"
	case escrow.StatusReleased:
		return "released"
	case escrow.StatusPartiallyRefunded:
		if row.ReleasedToSellerMinor > 0 {
			return "released"
		}
	}
	return "refunded"
}

func WeekStartOf(moment time.Time, location *time.Location) time.Time {
	local := moment.In(location)
	offset := (int(local.Weekday()) + 6) % 7
	return time.Date(local.Year(), local.Month(), local.Day()-offset, 0, 0, 0, 0, location)
}

func SettlementIdFor(weekStart time.Time) string {
	return "stl_" + weekStart.Format("20060102")
}

func (escrows SellerEscrows) Present(ctx context.Context, seller dtos.SellerContext, rows []*escrowent.Escrow) ([]dtos.EscrowEntryView, error) {
	buyerIds := []uuid.UUID{}
	for _, row := range rows {
		if identifier, err := uuid.Parse(row.BuyerUserID); err == nil {
			buyerIds = append(buyerIds, identifier)
		}
	}
	profiles, err := usersdirectory.Reader{Database: escrows.Container.Resources.Database, Schema: escrows.Container.Settings.UsersSchema}.PersonalProfilesByAccount(ctx, buyerIds)
	if err != nil {
		escrows.Container.Resources.Logger.WarnContext(ctx, "buyer names are unavailable for finance views", "error", err)
		profiles = map[uuid.UUID]usersdirectory.ProfileName{}
	}
	views := make([]dtos.EscrowEntryView, 0, len(rows))
	for _, row := range rows {
		profile := profiles[uuid.MustParse(row.BuyerUserID)]
		status := DashboardEscrowStatus(row)
		var expected, settlement *string
		if status == "held" {
			expected = formatOptionalTime(row.AutoReleaseAt)
		}
		if row.ReleasedAt != nil {
			identifier := SettlementIdFor(WeekStartOf(*row.ReleasedAt, seller.Location))
			settlement = &identifier
		}
		views = append(views, dtos.EscrowEntryView{
			OrderId: row.OrderID, OrderNumber: row.OrderReference, BuyerName: profile.Name, BuyerUsername: profile.Handle,
			Gross: seller.Money(row.AmountMinor), Fees: seller.Money(row.CommissionMinor + row.ProcessingFeeMinor), Net: seller.Money(row.SellerAmountMinor),
			Status: status, HeldAt: row.CreatedAt.UTC().Format(time.RFC3339), ReleaseExpectedAt: expected, ReleasedAt: formatOptionalTime(row.ReleasedAt), SettlementId: settlement,
		})
	}
	return views, nil
}
