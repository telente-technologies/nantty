package services

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/escrow/src/generated/ent"
)

func TestConvertEscrowToUndeliveredReviewRowIncludesOnlySafeTrackingLinks(t *testing.T) {
	reviewSince := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name     string
		tracking string
		wantLink bool
	}{
		{name: "https link", tracking: "https://carrier.example/track/123", wantLink: true},
		{name: "http link", tracking: "http://carrier.example/track/123"},
		{name: "javascript URL", tracking: "javascript:alert(1)"},
		{name: "credential URL", tracking: "https://user:pass@carrier.example/track/123"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			row := ConvertEscrowToUndeliveredReviewRow(&ent.Escrow{
				ID: uuid.New(), UndeliveredReviewAt: &reviewSince, TrackingURL: test.tracking,
			})
			if got := row.TrackingUrl != nil; got != test.wantLink {
				t.Fatalf("tracking link present = %v, want %v", got, test.wantLink)
			}
			if row.TrackingUrl != nil && *row.TrackingUrl != test.tracking {
				t.Fatalf("tracking link = %q, want %q", *row.TrackingUrl, test.tracking)
			}
		})
	}
}
