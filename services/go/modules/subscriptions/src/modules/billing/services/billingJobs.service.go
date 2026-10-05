package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	platformevents "zudomart/platform/events"
)

const SubscriptionBillingJobType = "subscriptionBilling.processDue"

type subscriptionBillingJob struct {
	SubscriptionId string `json:"subscriptionId"`
}

func (billing Billing) EnqueueSubscriptionBillingJob(ctx context.Context, subscriptionId string) error {
	if billing.Container.Jobs == nil {
		return billing.ProcessDueSubscription(ctx, subscriptionId)
	}
	payload, _ := json.Marshal(subscriptionBillingJob{SubscriptionId: subscriptionId})
	return billing.Container.Jobs.EnqueueJob(ctx, billing.Container.Settings.BillingJobsQueue, platformevents.Job{Id: uuid.NewString(), Type: SubscriptionBillingJobType, Payload: payload})
}

func (billing Billing) HandleSubscriptionBillingJobMessage(ctx context.Context, body []byte) error {
	var job platformevents.Job
	if err := json.Unmarshal(body, &job); err != nil || job.Type != SubscriptionBillingJobType {
		return fmt.Errorf("%w: subscription billing job", platformevents.ErrPoisonMessage)
	}
	var payload subscriptionBillingJob
	if err := json.Unmarshal(job.Payload, &payload); err != nil || payload.SubscriptionId == "" {
		return fmt.Errorf("%w: subscription billing payload", platformevents.ErrPoisonMessage)
	}
	return billing.ProcessDueSubscription(ctx, payload.SubscriptionId)
}
