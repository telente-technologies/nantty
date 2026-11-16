package controllers_test

import (
	"slices"
	"testing"

	"nantty/modules/ads/src/modules/decision/controllers"
	"nantty/modules/ads/src/modules/decision/dtos"
)

func TestResolveSignedInViewerIgnoresCallerCustomAudienceIds(t *testing.T) {
	viewer := controllers.ResolveSignedInViewer("user-1", "NG", &dtos.ViewerHints{
		Region:            "LA",
		AgeBand:           "25-34",
		Gender:            "female",
		Topics:            []string{"fashion"},
		CustomAudienceIds: []string{"forged-audience-id"},
	})
	if len(viewer.CustomAudienceIds) != 0 {
		t.Fatalf("signed-in viewer must never accept caller-supplied customAudienceIds: %v", viewer.CustomAudienceIds)
	}
	if viewer.Country != "NG" || viewer.Region != "LA" || !slices.Equal(viewer.Topics, []string{"fashion"}) {
		t.Fatalf("expected non-privileged viewer hints to be preserved, got %+v", viewer)
	}
}
