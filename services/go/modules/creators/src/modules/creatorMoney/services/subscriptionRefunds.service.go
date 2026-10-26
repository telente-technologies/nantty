package services

import (
	"context"
	"time"

	"nantty/modules/creators/src/generated/ent/creatorearning"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
)

type CreatorSubscriptionRefunded struct {
	SubscriptionId string `json:"subscriptionId"`
	ChargeId       string `json:"chargeId"`
	CreatorId      string `json:"creatorId"`
	Recovered      Money  `json:"recovered"`
	Shortfall      Money  `json:"shortfall"`
}

func (money CreatorMoney) ReverseSubscriptionEarning(ctx context.Context, refunded CreatorSubscriptionRefunded, at time.Time) error {
	if refunded.CreatorId == "" || refunded.ChargeId == "" {
		return nil
	}
	reference := "creator-subscription-charge:" + refunded.ChargeId
	client := money.Container.Client(money.Container.Resources.Database)
	updated, err := client.CreatorEarning.Update().
		Where(creatorearning.Reference(reference), creatorearning.KindEQ(creatorearning.KindSubscription), creatorearning.StatusNEQ(creatorearning.StatusReversed)).
		SetStatus(creatorearning.StatusReversed).Save(ctx)
	if err != nil || updated > 0 {
		return err
	}
	share := refunded.Recovered.AmountMinor + refunded.Shortfall.AmountMinor
	unit := refunded.Recovered.Currency
	if unit == "" {
		unit = refunded.Shortfall.Currency
	}
	if share <= 0 || unit == "" {
		return nil
	}
	_, err = programservices.RecordEarning(ctx, client, programservices.Earning{
		CreatorId: refunded.CreatorId, Kind: "subscription", Reference: reference, SourceType: "subscription", SourceId: refunded.SubscriptionId,
		Description: "Subscription refunded", GrossMinor: share, NetMinor: share, Unit: unit, Status: creatorearning.StatusReversed, At: at.UTC(),
	})
	return err
}
