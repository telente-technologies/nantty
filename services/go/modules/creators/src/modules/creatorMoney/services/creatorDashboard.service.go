package services

import (
	"context"
	"sort"
	"time"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/creatorearning"
	"nantty/modules/creators/src/generated/ent/gifttransaction"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

type DashboardEarnings struct {
	Gifts                Money `json:"gifts"`
	Tips                 Money `json:"tips"`
	AffiliateCommissions Money `json:"affiliateCommissions"`
	Subscriptions        Money `json:"subscriptions"`
	AdRevenue            Money `json:"adRevenue"`
	Bonuses              Money `json:"bonuses"`
	Total                Money `json:"total"`
}

type TopContentView struct {
	Id           string  `json:"id"`
	Kind         string  `json:"kind"`
	Title        string  `json:"title"`
	ThumbnailUrl *string `json:"thumbnailUrl"`
	Views        int64   `json:"views"`
	Earnings     Money   `json:"earnings"`
}

type DashboardView struct {
	Period           string            `json:"period"`
	Since            *time.Time        `json:"since"`
	Currency         string            `json:"currency"`
	Earnings         DashboardEarnings `json:"earnings"`
	PendingBalance   Money             `json:"pendingBalance"`
	AvailableBalance Money             `json:"availableBalance"`
	FollowersGained  int64             `json:"followersGained"`
	Followers        struct {
		Total          int64  `json:"total"`
		GainedInPeriod *int64 `json:"gainedInPeriod"`
	} `json:"followers"`
	Coins struct {
		Earned int64 `json:"earned"`
	} `json:"coins"`
	TopContent []TopContentView `json:"topContent"`
}

func PeriodStart(period string, now time.Time) *time.Time {
	var since time.Time
	switch period {
	case "today":
		since = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	case "week":
		since = now.AddDate(0, 0, -7)
	case "month":
		since = now.AddDate(0, -1, 0)
	default:
		return nil
	}
	return &since
}

func (money CreatorMoney) BuildDashboard(ctx context.Context, creatorId, period, currency string) (DashboardView, error) {
	member, err := money.Program.FindMembership(ctx, creatorId)
	if err != nil {
		return DashboardView{}, err
	}
	if member == nil {
		return DashboardView{}, ErrCreatorProgramOnly
	}
	currency = NormalizeCurrency(currency)
	now := money.Container.Now().UTC()
	view := DashboardView{Period: period, Since: PeriodStart(period, now), Currency: currency, TopContent: []TopContentView{}}
	database := money.Container.Resources.Database
	query := money.Container.Client(database).CreatorEarning.Query().Where(creatorearning.CreatorID(creatorId), creatorearning.StatusNEQ(creatorearning.StatusReversed))
	if view.Since != nil {
		query.Where(creatorearning.CreatedAtGTE(*view.Since))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return DashboardView{}, err
	}
	coinValue := money.coinCashValue(ctx, currency)
	toCash := func(row *ent.CreatorEarning) int64 {
		if row.Unit == "COIN" {
			return row.NetMinor * coinValue
		}
		if row.Unit == currency {
			return row.NetMinor
		}
		return 0
	}
	totals := map[creatorearning.Kind]int64{}
	for _, row := range rows {
		totals[row.Kind] += toCash(row)
	}
	cash := func(amount int64) Money { return Money{amount, currency} }
	view.Earnings = DashboardEarnings{
		Gifts: cash(totals[creatorearning.KindGift] + totals[creatorearning.KindTip]), Tips: cash(totals[creatorearning.KindTip]), AffiliateCommissions: cash(totals[creatorearning.KindAffiliate]),
		Subscriptions: cash(totals[creatorearning.KindSubscription]), AdRevenue: cash(totals[creatorearning.KindAdRevenue]),
		Bonuses: cash(totals[creatorearning.KindSubscription] + totals[creatorearning.KindAdRevenue]),
	}
	view.Earnings.Total = cash(view.Earnings.Gifts.AmountMinor + view.Earnings.AffiliateCommissions.AmountMinor + view.Earnings.Bonuses.AmountMinor)
	earnedCoins, err := money.Container.Ledger.ReadAccountBalance(ctx, database, ledgermodels.CreatorEarnedCoinsAccount(creatorId))
	if err != nil {
		return DashboardView{}, err
	}
	available, err := money.Container.Ledger.ReadAccountBalance(ctx, database, ledgermodels.CreatorEarningsPayableAccount(creatorId, currency))
	if err != nil {
		return DashboardView{}, err
	}
	view.Coins.Earned, view.PendingBalance, view.AvailableBalance = earnedCoins, cash(earnedCoins*coinValue), cash(available)
	if view.Followers.Total, err = money.Container.Directory.FollowerCount(ctx, creatorId); err != nil {
		return DashboardView{}, err
	}
	if view.Since == nil {
		gained := view.Followers.Total
		view.Followers.GainedInPeriod, view.FollowersGained = &gained, gained
	}
	view.TopContent, err = money.topLives(ctx, creatorId, view.Since, currency)
	return view, err
}

func (money CreatorMoney) topLives(ctx context.Context, creatorId string, since *time.Time, currency string) ([]TopContentView, error) {
	query := money.Container.Client(money.Container.Resources.Database).GiftTransaction.Query().Where(gifttransaction.CreditedUserID(creatorId), gifttransaction.StatusEQ(gifttransaction.StatusCommitted), gifttransaction.BattleID(""))
	if since != nil {
		query.Where(gifttransaction.CreatedAtGTE(*since))
	}
	var sums []struct {
		LiveId string `json:"live_id"`
		Coins  int64  `json:"sum"`
	}
	if err := query.GroupBy(gifttransaction.FieldLiveID).Aggregate(ent.Sum(gifttransaction.FieldCreatorAmountCoins)).Scan(ctx, &sums); err != nil {
		return nil, err
	}
	sort.Slice(sums, func(left, right int) bool { return sums[left].Coins > sums[right].Coins })
	top := []TopContentView{}
	for _, sum := range sums[:min(len(sums), 5)] {
		live, _, err := money.Container.Directory.FindLive(ctx, sum.LiveId)
		if err != nil {
			return nil, err
		}
		top = append(top, TopContentView{Id: sum.LiveId, Kind: "live", Title: live.Title, Earnings: Money{sum.Coins * money.coinCashValue(ctx, currency), currency}})
	}
	return top, nil
}
