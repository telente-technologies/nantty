package services

import (
	"context"

	"zudomart/modules/payments/src/interfaces"
)

func (gateway *PaymentGateway) CreateRecurringPlanProduct(ctx context.Context, request interfaces.RecurringPlanRequest) (string, error) {
	provider, err := gateway.Container.DefaultSubscriptions()
	if err != nil {
		return "", err
	}
	planCode, err := provider.CreateRecurringPlan(ctx, request)
	return planCode, convertProviderError(err)
}

func (gateway *PaymentGateway) CreateProviderSubscription(ctx context.Context, request interfaces.SubscriptionRequest) (interfaces.ProviderSubscription, error) {
	provider, err := gateway.Container.DefaultSubscriptions()
	if err != nil {
		return interfaces.ProviderSubscription{}, err
	}
	subscription, err := provider.CreateSubscription(ctx, request)
	return subscription, convertProviderError(err)
}

func (gateway *PaymentGateway) DisableProviderSubscription(ctx context.Context, subscriptionCode, emailToken string) error {
	provider, err := gateway.Container.DefaultSubscriptions()
	if err != nil {
		return err
	}
	return convertProviderError(provider.DisableSubscription(ctx, subscriptionCode, emailToken))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
