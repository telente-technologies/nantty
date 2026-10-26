package services

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adfreeboostgrant"
	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/modules/ads/src/types"
)

const DefaultBoostTimezone = "Africa/Lagos"

func IsNativeClient(platform string) bool {
	return slices.Contains([]string{"ios", "android"}, strings.ToLower(strings.TrimSpace(platform)))
}

func PaymentMethodsFor(platform string, premium bool) []string {
	methods := []string{"card"}
	if !IsNativeClient(platform) {
		methods = append(methods, "balance")
	}
	if premium {
		methods = append(methods, "free")
	}
	return methods
}

func FreeBoostPeriod(at time.Time, timezone string) (string, time.Time) {
	location, err := time.LoadLocation(timezone)
	if err != nil {
		location = time.UTC
	}
	local := at.In(location)
	start := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, location)
	return local.Format("2006-01"), start.AddDate(0, 1, 0).UTC()
}

func FindPersonalBoostAccount(ctx context.Context, client *ent.Client, userId uuid.UUID, currency string) (*ent.AdAccount, error) {
	account, err := client.AdAccount.Query().Where(adaccount.OwnerUserID(userId), adaccount.CurrencyEQ(currency), adaccount.KindEQ(adaccount.KindPersonal), adaccount.StatusEQ(adaccount.StatusActive)).
		Order(adaccount.ByID()).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return account, err
}

func BoostTimezoneFor(ctx context.Context, client *ent.Client, userId uuid.UUID, currency string) (string, error) {
	account, err := FindPersonalBoostAccount(ctx, client, userId, currency)
	if err != nil {
		return "", err
	}
	if account == nil {
		return DefaultBoostTimezone, nil
	}
	return account.Timezone, nil
}

func ReadFreeBoost(ctx context.Context, deployed *container.Container, userId uuid.UUID, premium bool, maxTotal types.Money) (dtos.FreeBoost, error) {
	timezone, err := BoostTimezoneFor(ctx, deployed.Client, userId, maxTotal.Currency)
	if err != nil {
		return dtos.FreeBoost{}, err
	}
	period, resetsAt := FreeBoostPeriod(deployed.Now(), timezone)
	view := dtos.FreeBoost{Premium: premium, MaxTotal: maxTotal, ResetsAt: resetsAt.Format(time.RFC3339)}
	if !premium {
		return view, nil
	}
	used, err := deployed.Client.AdFreeBoostGrant.Query().Where(adfreeboostgrant.UserID(userId), adfreeboostgrant.PeriodKey(period)).Exist(ctx)
	if err != nil {
		return dtos.FreeBoost{}, err
	}
	if !used {
		view.Eligible, view.RemainingThisMonth = true, 1
	}
	return view, nil
}
