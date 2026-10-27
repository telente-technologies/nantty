package integrations

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
)

func TestStaffInvitationTokensAreOnlyLoggedWhereLoggingIsAllowed(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	refused := DevelopmentLogInvitationDelivery{Logger: logger}
	if err := refused.DeliverStaffInvitation(context.Background(), "ops@nantty.test", "Ops", "secret-token"); !errors.Is(err, ErrInvitationDeliveryUnavailable) {
		t.Fatalf("delivery must fail closed outside development, got %v", err)
	}
	if strings.Contains(logs.String(), "secret-token") {
		t.Fatal("an invitation token must never reach the logs in production")
	}
	allowed := DevelopmentLogInvitationDelivery{Logger: logger, LoggingAllowed: true}
	if err := allowed.DeliverStaffInvitation(context.Background(), "ops@nantty.test", "Ops", "dev-token"); err != nil || !strings.Contains(logs.String(), "dev-token") {
		t.Fatalf("local development still logs the invitation link, err=%v", err)
	}
}
