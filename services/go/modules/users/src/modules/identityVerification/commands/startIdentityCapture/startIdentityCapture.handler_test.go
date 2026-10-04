package startidentitycapture

import (
	"context"
	"testing"

	"zudomart/modules/users/src/configs"
	"zudomart/modules/users/src/container"
)

func TestCaptureNeedsExplicitCurrentConsentAndASupportedPhotoId(t *testing.T) {
	handler := Handler{Container: &container.Container{Settings: configs.UsersSettings{Verification: configs.IdentityVerificationSettings{ConsentVersion: "2026-10-04"}}}}
	cases := []Command{
		{ConsentAccepted: false, ConsentVersion: "2026-10-04", DocumentCountry: "NG", DocumentType: "NIN_SLIP"},
		{ConsentAccepted: true, ConsentVersion: "2025-01-01", DocumentCountry: "NG", DocumentType: "NIN_SLIP"},
		{ConsentAccepted: true, ConsentVersion: "2026-10-04", DocumentCountry: "NG", DocumentType: "STUDENT_CARD"},
	}
	for _, command := range cases {
		if _, err := handler.Execute(context.Background(), command); err == nil {
			t.Fatalf("capture must be refused for %+v", command)
		}
	}
}
