package services_test

import (
	"testing"

	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/modules/ads/src/modules/boosts/services"
)

func TestBoostDestinationsDefaultToPostsAndKeepTheirOwnGoals(t *testing.T) {
	legacy := services.NormalizeBoostDestination(dtos.BoostEstimateRequest{PostId: " post-1 "})
	if legacy.DestinationType != services.DestinationPost || legacy.TargetId != "post-1" || legacy.PostId != "post-1" {
		t.Fatalf("a request with only postId boosts that post: %+v", legacy)
	}
	store := services.NormalizeBoostDestination(dtos.BoostEstimateRequest{PostId: "post-1", DestinationType: "store", TargetId: "store-1"})
	if store.PostId != "" || store.TargetId != "store-1" {
		t.Fatalf("a store boost never carries a post id: %+v", store)
	}
	cases := []struct {
		goal, destination string
		allowed           bool
	}{
		{"views", services.DestinationPost, true}, {"messages", services.DestinationPost, true}, {"store_visits", services.DestinationPost, false},
		{"profile_visits", services.DestinationProfile, true}, {"views", services.DestinationProfile, false}, {"store_visits", services.DestinationProfile, false},
		{"store_visits", services.DestinationStore, true}, {"profile_visits", services.DestinationStore, false}, {"messages", services.DestinationStore, false},
	}
	for _, testCase := range cases {
		if services.IsGoalAllowedForDestination(testCase.goal, testCase.destination) != testCase.allowed {
			t.Fatalf("goal %s on %s allowed should be %v", testCase.goal, testCase.destination, testCase.allowed)
		}
	}
}

func TestStoreAndProfileBoostCreativesOpenTheirTarget(t *testing.T) {
	store := services.BoostCreativeInput(services.NormalizeBoostDestination(dtos.BoostEstimateRequest{DestinationType: "store", TargetId: "store-1", Goal: "store_visits"}))
	if store.Format != "store" || store.Source.Type != "store" || store.Destination.Type != "store" || *store.Destination.TargetId != "store-1" || store.CallToAction != "visit_store" || store.Headline != "Boosted store" {
		t.Fatalf("store boost creative %+v", store)
	}
	profile := services.BoostCreativeInput(services.NormalizeBoostDestination(dtos.BoostEstimateRequest{DestinationType: "profile", TargetId: "user-1", Goal: "profile_visits"}))
	if profile.Format != "feed_post" || profile.Destination.Type != "profile" || profile.CallToAction != "follow" || profile.Headline != "Boosted profile" {
		t.Fatalf("profile boost creative %+v", profile)
	}
	post := services.BoostCreativeInput(services.NormalizeBoostDestination(dtos.BoostEstimateRequest{PostId: "post-1", Goal: "messages"}))
	if post.Destination.Type != "messages" || post.Source.Type != "post" || post.Headline != "Boosted post" {
		t.Fatalf("a messages boost still opens messages: %+v", post)
	}
}
