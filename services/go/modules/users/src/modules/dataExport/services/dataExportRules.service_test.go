package services

import (
	"testing"
	"time"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/dataexportrequest"
)

func TestEvaluateExportRequestEligibility(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	request := func(status dataexportrequest.Status, age time.Duration) *ent.DataExportRequest {
		return &ent.DataExportRequest{Status: status, CreatedAt: now.Add(-age)}
	}
	cases := []struct {
		name     string
		existing []*ent.DataExportRequest
		want     error
	}{
		{"first request", nil, nil},
		{"requested is active", []*ent.DataExportRequest{request(dataexportrequest.StatusRequested, time.Minute)}, ErrExportAlreadyActive},
		{"processing is active", []*ent.DataExportRequest{request(dataexportrequest.StatusProcessing, 48*time.Hour)}, ErrExportAlreadyActive},
		{"ready within 24h is rate limited", []*ent.DataExportRequest{request(dataexportrequest.StatusReady, 2*time.Hour)}, ErrExportRateLimited},
		{"ready after 24h is allowed", []*ent.DataExportRequest{request(dataexportrequest.StatusReady, 25*time.Hour)}, nil},
		{"failed does not count", []*ent.DataExportRequest{request(dataexportrequest.StatusFailed, time.Minute)}, nil},
		{"expired within 24h still counts", []*ent.DataExportRequest{request(dataexportrequest.StatusExpired, time.Hour)}, ErrExportRateLimited},
	}
	for _, testCase := range cases {
		if got := EvaluateExportRequestEligibility(now, testCase.existing); got != testCase.want {
			t.Errorf("%s: got %v want %v", testCase.name, got, testCase.want)
		}
	}
}

func TestIsDownloadAvailableRespectsExpiry(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	key, soon, past := "k", now.Add(time.Hour), now.Add(-time.Second)
	if !IsDownloadAvailable(&ent.DataExportRequest{Status: dataexportrequest.StatusReady, ObjectKey: &key, ExpiresAt: &soon}, now) {
		t.Error("ready, unexpired archive should be downloadable")
	}
	if IsDownloadAvailable(&ent.DataExportRequest{Status: dataexportrequest.StatusReady, ObjectKey: &key, ExpiresAt: &past}, now) {
		t.Error("expired archive must not be downloadable")
	}
	if IsDownloadAvailable(&ent.DataExportRequest{Status: dataexportrequest.StatusProcessing, ObjectKey: &key, ExpiresAt: &soon}, now) {
		t.Error("unfinished export must not be downloadable")
	}
}
