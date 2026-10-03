package application

import (
	"context"
	"log/slog"
)

type OneTimeCodeDelivery interface {
	DeliverOneTimeCode(ctx context.Context, destination, purpose, code string) error
	DeliverAccountAlreadyExistsNotice(ctx context.Context, destination string) error
}

type DevelopmentLogDelivery struct {
	Logger *slog.Logger
}

func (delivery DevelopmentLogDelivery) DeliverOneTimeCode(ctx context.Context, destination, purpose, code string) error {
	delivery.Logger.WarnContext(ctx, "development delivery only: one-time "+purpose+" passcode for "+destination+" is "+code)
	return nil
}

func (delivery DevelopmentLogDelivery) DeliverAccountAlreadyExistsNotice(ctx context.Context, destination string) error {
	delivery.Logger.WarnContext(ctx, "development delivery only: account already exists notice for "+destination)
	return nil
}
