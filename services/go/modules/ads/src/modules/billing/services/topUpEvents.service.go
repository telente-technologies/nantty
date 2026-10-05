package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	applytopupresult "zudomart/modules/ads/src/modules/billing/commands/applyTopUpResult"
	platformevents "zudomart/platform/events"
)

const AdBalanceToppedUp = "adBalance.toppedUp"

type toppedUpData struct {
	AdAccountId string `json:"adAccountId"`
	TopUpId     string `json:"topUpId"`
	Amount      struct {
		AmountMinor int64  `json:"amountMinor"`
		Currency    string `json:"currency"`
	} `json:"amount"`
}

func HandleToppedUpEvent(ctx context.Context, deployed *container.Container, envelope platformevents.EventEnvelope) error {
	var data toppedUpData
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data.TopUpId == "" || data.Amount.AmountMinor <= 0 {
		return fmt.Errorf("%w: adBalance.toppedUp data is malformed", platformevents.ErrPoisonMessage)
	}
	accountId, err := uuid.Parse(data.AdAccountId)
	if err != nil {
		return nil
	}
	return (applytopupresult.Handler{Container: deployed}).Execute(ctx, applytopupresult.Command{
		AccountId: accountId, TopUpId: data.TopUpId, AmountMinor: data.Amount.AmountMinor, Currency: data.Amount.Currency, OccurredAt: envelope.OccurredAt,
	})
}
