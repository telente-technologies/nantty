package application

import (
	"context"
	"log/slog"
)

type InvitationDelivery interface {
	DeliverStaffInvitation(ctx context.Context, email, displayName, invitationToken string) error
}

type DevelopmentLogInvitationDelivery struct {
	Logger *slog.Logger
}

func (delivery DevelopmentLogInvitationDelivery) DeliverStaffInvitation(ctx context.Context, email, _ string, invitationToken string) error {
	delivery.Logger.WarnContext(ctx, "development delivery only: staff invitation for "+email+" token "+invitationToken)
	return nil
}
