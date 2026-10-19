package services

import (
	"testing"

	"zudomart/modules/ads/src/modules/boosts/dtos"
)

func TestBoostDestinationsDefaultToPostsAndKeepTheirOwnGoals(t *testing.T) {
	legacy := NormalizeBoostDestination(dtos.BoostEstimateRequest{PostId: " post-1 "})
	if legacy.DestinationType != DestinationPost || legacy.TargetId != "post-1" || legacy.PostId != "post-1" {
		t.Fatalf("a request with only postId boosts that post: %+v", legacy)
	}
	store := NormalizeBoostDestination(dtos.BoostEstimateRequest{PostId: "post-1", DestinationType: "store", TargetId: "store-1"})
	if store.PostId != "" || store.TargetId != "store-1" {
		t.Fatalf("a store boost never carries a post id: %+v", store)
	}
	cases := []struct {
		goal, destination string
		allowed           bool
	}{
		{"views", DestinationPost, true}, {"messages", DestinationPost, true}, {"store_visits", DestinationPost, false},
		{"profile_visits", DestinationProfile, true}, {"views", DestinationProfile, false}, {"store_visits", DestinationProfile, false},
		{"store_visits", DestinationStore, true}, {"profile_visits", DestinationStore, false}, {"messages", DestinationStore, false},
	}
	for _, testCase := range cases {
		if IsGoalAllowedForDestination(testCase.goal, testCase.destination) != testCase.allowed {
			t.Fatalf("goal %s on %s allowed should be %v", testCase.goal, testCase.destination, testCase.allowed)
		}
	}
}

func TestStoreAndProfileBoostCreativesOpenTheirTarget(t *testing.T) {
	store := BoostCreativeInput(NormalizeBoostDestination(dtos.BoostEstimateRequest{DestinationType: "store", TargetId: "store-1", Goal: "store_visits"}))
	if store.Format != "store" || store.Source.Type != "store" || store.Destination.Type != "store" || *store.Destination.TargetId != "store-1" || store.CallToAction != "visit_store" || store.Headline != "Boosted store" {
		t.Fatalf("store boost creative %+v", store)
	}
	profile := BoostCreativeInput(NormalizeBoostDestination(dtos.BoostEstimateRequest{DestinationType: "profile", TargetId: "user-1", Goal: "profile_visits"}))
	if profile.Format != "feed_post" || profile.Destination.Type != "profile" || profile.CallToAction != "follow" || profile.Headline != "Boosted profile" {
		t.Fatalf("profile boost creative %+v", profile)
	}
	post := BoostCreativeInput(NormalizeBoostDestination(dtos.BoostEstimateRequest{PostId: "post-1", Goal: "messages"}))
	if post.Destination.Type != "messages" || post.Source.Type != "post" || post.Headline != "Boosted post" {
		t.Fatalf("a messages boost still opens messages: %+v", post)
	}
}
