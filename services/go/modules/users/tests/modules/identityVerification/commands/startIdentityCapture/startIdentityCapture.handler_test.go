package startidentitycapture_test

import (
	"context"
	"strings"
	"testing"

	"nantty/modules/users/src/configs"
	"nantty/modules/users/src/container"
	startidentitycapture "nantty/modules/users/src/modules/identityVerification/commands/startIdentityCapture"
)

func TestCaptureNeedsExplicitCurrentConsent(t *testing.T) {
	handler := startidentitycapture.Handler{Container: &container.Container{Settings: configs.UsersSettings{Verification: configs.IdentityVerificationSettings{ConsentVersion: "2026-11-20"}}}}
	cases := []startidentitycapture.Command{
		{ConsentAccepted: false, ConsentVersion: "2026-11-20", DocumentCountry: "NG", DocumentType: "PASSPORT"},
		{ConsentAccepted: true, ConsentVersion: "2025-01-01", DocumentCountry: "NG", DocumentType: "PASSPORT"},
	}
	for _, command := range cases {
		if _, err := handler.Execute(context.Background(), command); err == nil {
			t.Fatalf("capture must be refused for %+v", command)
		}
	}
}

func TestCaptureFailsClosedUntilPartnerProductIsEnabled(t *testing.T) {
	handler := startidentitycapture.Handler{Container: &container.Container{Settings: configs.UsersSettings{Verification: configs.IdentityVerificationSettings{ConsentVersion: "2026-11-20"}}}}
	_, err := handler.Execute(context.Background(), startidentitycapture.Command{
		ConsentAccepted: true, ConsentVersion: "2026-11-20", VerificationMethod: "document", DocumentCountry: "US", DocumentType: "PASSPORT",
	})
	if err == nil || !strings.Contains(err.Error(), "IDENTITY_CHECK_UNAVAILABLE") {
		t.Fatalf("capture must fail closed without configured account entitlement, got %v", err)
	}
}
