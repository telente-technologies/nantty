package services

import (
	"context"
	"errors"
	"testing"

	"nantty/modules/ads/src/interfaces"
	"nantty/modules/ads/src/types"
)

type stubPromotedDirectory struct {
	found map[string]interfaces.PromotedDestination
	err   error
}

func (directory stubPromotedDirectory) LookupDestinations(_ context.Context, kind string, ids []string) (map[string]interfaces.PromotedDestination, error) {
	byId := map[string]interfaces.PromotedDestination{}
	for _, id := range ids {
		if destination, exists := directory.found[kind+":"+id]; exists {
			byId[id] = destination
		}
	}
	return byId, directory.err
}

func (stubPromotedDirectory) ListPromotableDestinations(context.Context, string, string) ([]interfaces.PromotedDestination, error) {
	return nil, nil
}

func entityCandidate(adId, kind, id string) types.CandidateAd {
	return types.CandidateAd{AdId: adId, Creative: types.Creative{Format: "feed_post", Source: types.CreativeSource{Type: kind, Id: id}, Destination: types.CreativeDestination{Type: kind, TargetId: &id}, Identity: types.CreativeIdentity{Name: "Boosted posts"}}}
}

func TestPromotedGateDropsSuspendedOrDeletedTargetsAndUsesTheTargetIdentity(t *testing.T) {
	storeId, profileId, missingId, postId := "store-1", "profile-1", "store-gone", "post-1"
	linked := types.CandidateAd{AdId: "linked", Creative: types.Creative{Format: "feed_post", Source: types.CreativeSource{Type: "post", Id: postId}, Destination: types.CreativeDestination{Type: "store", TargetId: &storeId}, Identity: types.CreativeIdentity{Name: "Ad account"}}}
	directory := stubPromotedDirectory{found: map[string]interfaces.PromotedDestination{
		"store:store-1":     {Kind: "store", Id: storeId, Name: "Ada Fabrics", Verified: true, CheckmarkColor: "gold", Available: true},
		"profile:profile-1": {Kind: "profile", Id: profileId, Name: "Ada", Private: true, Available: false},
	}}
	kept := ApplyPromotedDestinations(context.Background(), directory, nil, []types.CandidateAd{entityCandidate("store", "store", storeId), entityCandidate("profile", "profile", profileId), entityCandidate("gone", "store", missingId), linked})
	if len(kept) != 2 || kept[0].AdId != "store" || kept[1].AdId != "linked" {
		t.Fatalf("only ads for available targets stay: %+v", kept)
	}
	if kept[0].Creative.Identity.Name != "Ada Fabrics" || kept[0].Creative.Promoted == nil || kept[0].Creative.Promoted.CheckmarkColor != "gold" {
		t.Fatalf("a store ad shows the store: %+v", kept[0].Creative)
	}
	if kept[1].Creative.Identity.Name != "Ad account" || kept[1].Creative.Promoted == nil || kept[1].Creative.Promoted.Kind != "store" {
		t.Fatalf("a post ad that opens a store keeps its advertiser but carries the store card: %+v", kept[1].Creative)
	}
}

func TestPromotedGateServesUnchangedWhenTheDirectoryIsUnavailable(t *testing.T) {
	candidates := []types.CandidateAd{entityCandidate("store", "store", "store-1")}
	if kept := ApplyPromotedDestinations(context.Background(), stubPromotedDirectory{err: errors.New("down")}, nil, candidates); len(kept) != 1 || kept[0].Creative.Promoted != nil {
		t.Fatalf("a directory outage must not take every ad down: %+v", kept)
	}
	if kept := ApplyPromotedDestinations(context.Background(), nil, nil, candidates); len(kept) != 1 {
		t.Fatal("no directory means no gate")
	}
}

func TestStoreAndProfileCardsOnlyFillFeedAndCommentThreadSlots(t *testing.T) {
	store := entityCandidate("store", "store", "store-1").Creative
	store.Format = "store"
	profile := entityCandidate("profile", "profile", "profile-1").Creative
	for _, slotKind := range []string{SlotFeedPost, SlotFeedCommentThread} {
		if !CreativeFitsSlot(store, slotKind) || !CreativeFitsSlot(profile, slotKind) {
			t.Fatalf("store and profile cards fit %s", slotKind)
		}
	}
	for _, slotKind := range []string{SlotPreRoll, SlotPostRoll, SlotClipBetween, SlotStory, SlotLiveBreak, SlotMartTile, SlotSearchTile} {
		if CreativeFitsSlot(store, slotKind) || CreativeFitsSlot(profile, slotKind) {
			t.Fatalf("store and profile cards must not fill %s", slotKind)
		}
	}
	post := types.Creative{Format: "feed_post", Source: types.CreativeSource{Type: "post", Id: "post-1"}}
	if !CreativeFitsSlot(post, SlotPreRoll) {
		t.Fatal("a post creative keeps its pre-roll fit")
	}
}

func TestStoreAndProfileDestinationsResolveToInAppLinksOnEveryPlatform(t *testing.T) {
	for _, kind := range []string{"store", "profile"} {
		creative := entityCandidate(kind, kind, "target-9").Creative
		for _, platform := range []string{"ios", "android", "web"} {
			target, err := ResolveClickTarget(creative, 0, platform)
			if err != nil || target != "nantty://"+kind+"/target-9" || !IsSafeClickTarget(target) {
				t.Fatalf("%s on %s resolves to %q %v", kind, platform, target, err)
			}
		}
	}
}
