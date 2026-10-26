package services

import (
	"errors"
	"net/http"
	"testing"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/platform/httpserver"
)

func TestRequireCurrentVersionRejectsStaleVersionsWithTheCurrentOne(t *testing.T) {
	current := map[string]*ent.PolicyVersion{models.PolicyPrivacy: {Version: "2.1"}}
	if version, err := RequireCurrentVersion(current, models.PolicyPrivacy, ""); err != nil || version != "2.1" {
		t.Fatalf("absent presented version means current: %v %v", version, err)
	}
	if version, err := RequireCurrentVersion(current, models.PolicyPrivacy, "2.1"); err != nil || version != "2.1" {
		t.Fatalf("matching version passes: %v %v", version, err)
	}
	_, err := RequireCurrentVersion(current, models.PolicyPrivacy, "1.0")
	var apiError *httpserver.ApiError
	if !errors.As(err, &apiError) || apiError.Status != http.StatusConflict || apiError.Issues[0].Message != "current version is 2.1" {
		t.Fatalf("stale version must be 409 naming the current version, got %v", err)
	}
	if _, err := RequireCurrentVersion(current, models.PolicyTerms, ""); err == nil {
		t.Fatal("unpublished kind must fail")
	}
}
