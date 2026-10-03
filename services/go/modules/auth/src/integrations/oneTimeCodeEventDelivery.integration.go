package integrations

import (
	"context"
	"time"
)

type OtpEventWriter func(ctx context.Context, destination, purpose, code string, expiresIn time.Duration) error

type EventDelivery struct {
	Write     OtpEventWriter
	ExpiresIn time.Duration
}

func (delivery EventDelivery) DeliverOneTimeCode(ctx context.Context, destination, purpose, code string) error {
	return delivery.Write(ctx, destination, purpose, code, delivery.ExpiresIn)
}

func (delivery EventDelivery) DeliverAccountAlreadyExistsNotice(context.Context, string) error {
	return nil
}
