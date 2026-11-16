package services_test

import (
	"testing"

	"nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
)

func nigeriaAudience() types.AudienceSpec {
	return types.AudienceSpec{Locations: []types.LocationTarget{{Type: "country", Code: "NG", CountryCode: "NG"}}, AgeMin: 18, AgeMax: 65, Gender: "all"}
}

func personalizedViewer() types.Viewer {
	return types.Viewer{UserId: "u", Country: "NG", Region: "LA", AgeBand: "25-34", Gender: "female", PersonalizedAds: true, Topics: []string{"fashion"}}
}

func TestTargetingMatchesLocationAgeGenderAndInterests(t *testing.T) {
	audience := nigeriaAudience()
	audience.AgeMin, audience.AgeMax, audience.Gender, audience.TopicIds = 25, 40, "female", []string{"fashion", "beauty"}
	if ok, reason := services.MatchesTargeting(audience, personalizedViewer(), nil); !ok {
		t.Fatalf("expected match, got %s", reason)
	}
	viewer := personalizedViewer()
	viewer.Country = "GH"
	if ok, reason := services.MatchesTargeting(audience, viewer, nil); ok || reason != "location" {
		t.Fatalf("wrong country: %v %s", ok, reason)
	}
	viewer = personalizedViewer()
	viewer.AgeBand = "45-54"
	if ok, reason := services.MatchesTargeting(audience, viewer, nil); ok || reason != "age" {
		t.Fatalf("age band outside target: %v %s", ok, reason)
	}
	audience.Gender = "male"
	if ok, _ := services.MatchesTargeting(audience, personalizedViewer(), nil); ok {
		t.Fatal("gender mismatch must not match")
	}
}

func TestTargetingStateAndExcludedLocations(t *testing.T) {
	audience := nigeriaAudience()
	audience.ExcludedLocations = []types.LocationTarget{{Type: "state", Code: "NG-LA", CountryCode: "NG"}}
	if ok, reason := services.MatchesTargeting(audience, personalizedViewer(), nil); ok || reason != "excluded_location" {
		t.Fatalf("lagos is excluded: %v %s", ok, reason)
	}
}

func TestTargetingWithoutPersonalizationConsentIsContextualOnly(t *testing.T) {
	viewer := personalizedViewer()
	viewer.PersonalizedAds = false
	broad := nigeriaAudience()
	if ok, reason := services.MatchesTargeting(broad, viewer, nil); !ok {
		t.Fatalf("broad geo targeting works without consent: %s", reason)
	}
	narrow := nigeriaAudience()
	narrow.AgeMin, narrow.AgeMax = 25, 34
	if ok, reason := services.MatchesTargeting(narrow, viewer, nil); ok || reason != "requires_personalization" {
		t.Fatalf("demographic targeting needs consent: %v %s", ok, reason)
	}
	topical := nigeriaAudience()
	topical.TopicIds = []string{"fashion"}
	if ok, _ := services.MatchesTargeting(topical, viewer, []string{"football"}); ok {
		t.Fatal("contextual topic must match the content, not the viewer interests")
	}
	if ok, _ := services.MatchesTargeting(topical, viewer, []string{"fashion"}); !ok {
		t.Fatal("contextual topic match on the content should serve")
	}
}

func TestTargetingCustomAudiencesIncludeAndExclude(t *testing.T) {
	audience := nigeriaAudience()
	audience.CustomAudienceIds, audience.ExcludedCustomAudienceIds = []string{"buyers"}, []string{"refunded"}
	viewer := personalizedViewer()
	viewer.CustomAudienceIds = []string{"buyers"}
	if ok, _ := services.MatchesTargeting(audience, viewer, nil); !ok {
		t.Fatal("member of an included audience matches")
	}
	viewer.CustomAudienceIds = []string{"buyers", "refunded"}
	if ok, reason := services.MatchesTargeting(audience, viewer, nil); ok || reason != "excluded_custom_audience" {
		t.Fatalf("excluded audience wins: %v %s", ok, reason)
	}
}
