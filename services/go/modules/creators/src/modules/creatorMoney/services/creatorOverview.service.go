package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/creatorearning"
	"nantty/modules/creators/src/modules/liveMoney/models"
)

type Money struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type CreatorStatusView struct {
	Status           string     `json:"status"`
	CanGoLive        bool       `json:"canGoLive"`
	Tier             string     `json:"tier,omitempty"`
	GiftSharePercent int64      `json:"giftSharePercent"`
	SuspensionReason *string    `json:"suspensionReason"`
	SuspendedAt      *time.Time `json:"suspendedAt"`
	RecentViolations int        `json:"recentViolations"`
}

type RevenueRulesView struct {
	GiftCreatorSharePercentUpTo            int64  `json:"giftCreatorSharePercentUpTo"`
	TipCreatorSharePercent                 int64  `json:"tipCreatorSharePercent"`
	SubscriptionCreatorSharePercent        int64  `json:"subscriptionCreatorSharePercent"`
	SubscriptionShareBasis                 string `json:"subscriptionShareBasis"`
	AdsRevenueCreatorSharePercent          int64  `json:"adsRevenueCreatorSharePercent"`
	CoinTransferPlatformFeePercent         int64  `json:"coinTransferPlatformFeePercent"`
	AffiliateCommissionReleasedAfterEscrow bool   `json:"affiliateCommissionReleasedAfterEscrow"`
	AffiliateCommissionMaximumPercent      int64  `json:"affiliateCommissionMaximumPercent"`
	CoinCashValue                          Money  `json:"coinCashValue"`
	MinimumPayout                          Money  `json:"minimumPayout"`
	WithdrawalFeeDescription               string `json:"withdrawalFeeDescription"`
}

type EarningView struct {
	Id          string     `json:"id"`
	Kind        string     `json:"kind"`
	Source      string     `json:"source"`
	Description string     `json:"description"`
	Amount      Money      `json:"amount"`
	GrossAmount Money      `json:"grossAmount"`
	Status      string     `json:"status"`
	AvailableAt *time.Time `json:"availableAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	SourceRef   struct {
		Type string `json:"type"`
		Id   string `json:"id"`
	} `json:"sourceRef"`
}

func (money CreatorMoney) MyStatus(ctx context.Context, userId string) (CreatorStatusView, error) {
	member, err := money.Program.FindMembership(ctx, userId)
	if err != nil {
		return CreatorStatusView{}, err
	}
	view := CreatorStatusView{Status: "none"}
	if member == nil {
		status, err := money.Container.Directory.ApplicationStatus(ctx, userId)
		if status == "pending" || status == "rejected" {
			view.Status = status
		}
		return view, err
	}
	view.Status, view.Tier = member.Status.String(), member.TierID
	view.CanGoLive = view.Status == "approved"
	if view.CanGoLive {
		share, _, err := money.Program.ApprovedCreatorShare(ctx, money.Container.Resources.Database, userId)
		if err != nil {
			return view, err
		}
		view.GiftSharePercent = share / 100
	}
	if member.SuspensionReason != "" {
		view.SuspensionReason, view.SuspendedAt = &member.SuspensionReason, member.SuspendedAt
	}
	view.RecentViolations, err = money.Program.CountRecentViolations(ctx, userId, money.Container.Settings.Revenue.ViolationLookbackDays)
	return view, err
}

func NormalizeCurrency(currency string) string {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if len(currency) != 3 {
		return "NGN"
	}
	return currency
}

func (money CreatorMoney) RevenueRules(ctx context.Context, currency string) RevenueRulesView {
	revenue, platform := money.Container.Settings.Revenue, money.Container.Resources.Platform
	currency = NormalizeCurrency(currency)
	orDefault := func(value, fallback int64) int64 {
		if value <= 0 {
			return fallback
		}
		return value
	}
	giftCeiling := platform.GiftCreatorShareCeilingBps(ctx, models.MaximumCreatorGiftShareBps) / 100
	return RevenueRulesView{
		GiftCreatorSharePercentUpTo: giftCeiling, TipCreatorSharePercent: giftCeiling,
		SubscriptionCreatorSharePercent: 80, SubscriptionShareBasis: "net", AdsRevenueCreatorSharePercent: platform.CreatorAdShareBps(ctx, orDefault(revenue.AdsCreatorShareBps, 4000)) / 100,
		CoinTransferPlatformFeePercent: platform.CoinTransferFeeBps(ctx, orDefault(revenue.CoinTransferFeeBps, 200)) / 100, AffiliateCommissionReleasedAfterEscrow: true,
		AffiliateCommissionMaximumPercent: orDefault(revenue.MaximumAffiliateBps, 5000) / 100,
		CoinCashValue:                     Money{money.coinCashValue(ctx, currency), currency}, MinimumPayout: Money{orDefault(revenue.MinimumPayoutMinorByCurrency[currency], defaultMinimumPayoutMinor(currency)), currency},
		WithdrawalFeeDescription: "Withdrawals pass on the payment provider's bank transfer fee; the exact fee is shown before you confirm.",
	}
}

func defaultMinimumPayoutMinor(currency string) int64 {
	if currency == "NGN" {
		return 2_000_000
	}
	return 1_000
}

func (money CreatorMoney) coinCashValue(ctx context.Context, currency string) int64 {
	if value, found := money.Container.Resources.Platform.CoinCashValuesMinor(ctx, money.Container.Settings.Revenue.CoinCashValueMinorByCurrency)[currency]; found {
		return value
	}
	return map[string]int64{"NGN": 1000, "GHS": 10, "KES": 100, "ZAR": 15, "GBP": 1, "EUR": 1, "USD": 1}[currency]
}

func earningSource(kind creatorearning.Kind) string {
	switch kind {
	case creatorearning.KindGift, creatorearning.KindTip:
		return "gift"
	case creatorearning.KindAffiliate:
		return "affiliate_commission"
	}
	return "bonus"
}

func ConvertEarning(row *ent.CreatorEarning) EarningView {
	view := EarningView{
		Id: row.ID.String(), Kind: row.Kind.String(), Source: earningSource(row.Kind), Description: row.Description, Amount: Money{row.NetMinor, row.Unit},
		GrossAmount: Money{row.GrossMinor, row.Unit}, Status: row.Status.String(), AvailableAt: row.AvailableAt, CreatedAt: row.CreatedAt,
	}
	view.SourceRef.Type, view.SourceRef.Id = row.SourceType, row.SourceID
	return view
}

func (money CreatorMoney) ListEarnings(ctx context.Context, creatorId, cursor string, limit int) ([]EarningView, string, error) {
	query := money.Container.Client(money.Container.Resources.Database).CreatorEarning.Query().Where(creatorearning.CreatorID(creatorId))
	if before, err := uuid.Parse(cursor); err == nil {
		query.Where(creatorearning.IDLT(before))
	}
	rows, err := query.Order(ent.Desc(creatorearning.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > limit {
		rows, next = rows[:limit], rows[limit-1].ID.String()
	}
	views := make([]EarningView, 0, len(rows))
	for _, row := range rows {
		views = append(views, ConvertEarning(row))
	}
	return views, next, nil
}
