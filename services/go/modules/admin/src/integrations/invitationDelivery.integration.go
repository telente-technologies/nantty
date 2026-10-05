package integrations

import (
	"context"
	"errors"
	"log/slog"
)

var ErrInvitationDeliveryUnavailable = errors.New("staff invitation delivery is not configured for this environment")

type InvitationDelivery interface {
	DeliverStaffInvitation(ctx context.Context, email, displayName, invitationToken string) error
}

type DevelopmentLogInvitationDelivery struct {
	Logger         *slog.Logger
	LoggingAllowed bool
}

func (delivery DevelopmentLogInvitationDelivery) DeliverStaffInvitation(ctx context.Context, email, _ string, invitationToken string) error {
	if !delivery.LoggingAllowed {
		return ErrInvitationDeliveryUnavailable
	}
	delivery.Logger.WarnContext(ctx, "development delivery only: staff invitation for "+email+" token "+invitationToken)
	return nil
}
