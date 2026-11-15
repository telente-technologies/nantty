package catalog_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/interfaces"
	"nantty/platform/usersdirectory"
)

type recordingProductRecommender struct {
	personalizationAllowed bool
	recalledIds            []string
	candidateIds           []string
	orderedIds             []string
	surface                string
	rankingError           error
}

func (recommender *recordingProductRecommender) RecallProductIds(
	_ context.Context,
	_ uuid.UUID,
	personalizationAllowed bool,
	_ int,
) ([]string, error) {
	recommender.personalizationAllowed = personalizationAllowed
	if !personalizationAllowed {
		return []string{}, nil
	}
	return recommender.recalledIds, nil
}

func (recommender *recordingProductRecommender) RankProducts(
	_ context.Context,
	_ uuid.UUID,
	personalizationAllowed bool,
	_ string,
	surface string,
	candidates []interfaces.ProductRankingCandidate,
) ([]string, error) {
	recommender.personalizationAllowed = personalizationAllowed
	recommender.surface = surface
	recommender.candidateIds = make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		recommender.candidateIds = append(recommender.candidateIds, candidate.ProductId)
	}
	return recommender.orderedIds, recommender.rankingError
}

func TestProductRecommendationsExposeRankedEligibleProductsAndRespectConsent(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("recommendationowner")
	shop := harness.store(ownerId, "Recommendations Shop")
	first := harness.product(shop, "Popular Product", 1_000, true)
	second := harness.product(shop, "Recently Listed Product", 2_000, true)
	ranker := &recordingProductRecommender{orderedIds: []string{second.ID.String(), first.ID.String()}}
	harness.module.Container.ProductRecommender = ranker

	for _, viewer := range []string{"", "recommendationviewer"} {
		var token string
		if viewer != "" {
			_, token = harness.account(viewer)
		}
		response := harness.expect("GET", "/api/v1/mart/recommendations/for-you", token, nil, 200)
		data, ok := response["data"].(map[string]any)
		if !ok {
			t.Fatalf("recommendation response must contain data: %v", response)
		}
		products, ok := data["products"].([]any)
		if !ok || len(products) != 2 {
			t.Fatalf("recommendation response should contain both listed products: %v", data)
		}
		if products[0].(map[string]any)["id"] != second.ID.String() {
			t.Fatalf("Go must preserve the eligible Python ranking order: %v", products)
		}
		if ranker.personalizationAllowed {
			t.Fatal("guests and viewers without saved personalization consent must use contextual ranking")
		}
		if data["source"] != "popular" {
			t.Fatalf("a non-consenting viewer should receive the contextual source label: %v", data["source"])
		}
	}
	if len(ranker.candidateIds) != 2 {
		t.Fatalf("both eligible products should reach the bounded ranker: %v", ranker.candidateIds)
	}
	if ranker.surface != "for_you" {
		t.Fatalf("the default recommendation endpoint should retain the For You ranking: %q", ranker.surface)
	}
}

func TestProductRecommendationsAddConsentedInteractionRecallToEligibleCandidatePool(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("recallowner")
	shop := harness.store(ownerId, "Recall Shop")
	popular := harness.product(shop, "Popular Product", 10_000, true)
	recalled := harness.product(shop, "Interaction Product", 1, true)
	viewerId, token := harness.account("recallviewer")
	harness.directory.setPrivacy(viewerId, usersdirectory.PrivacyChoices{Analytics: true, Personalization: true})
	ranker := &recordingProductRecommender{
		recalledIds: []string{recalled.ID.String()},
		orderedIds:  []string{recalled.ID.String(), popular.ID.String()},
	}
	harness.module.Container.ProductRecommender = ranker
	response := harness.expect("GET", "/api/v1/mart/recommendations/for-you?surface=mart_home", token, nil, 200)
	data := response["data"].(map[string]any)
	products := data["products"].([]any)
	if len(products) != 2 || products[0].(map[string]any)["id"] != recalled.ID.String() {
		t.Fatalf("consented item-affinity recall should be considered ahead of popular candidates: %v", products)
	}
	if !ranker.personalizationAllowed {
		t.Fatal("explicitly consented viewer should permit personalized candidate recall")
	}
	if ranker.surface != "mart_home" {
		t.Fatalf("Mart should use its own ranking surface: %q", ranker.surface)
	}
}

func TestProductRecommendationsAcceptClipsRankingSurface(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("cliprecowner")
	shop := harness.store(ownerId, "Clip Recommendation Shop")
	product := harness.product(shop, "Clip Recommendation Product", 1_000, true)
	ranker := &recordingProductRecommender{orderedIds: []string{product.ID.String()}}
	harness.module.Container.ProductRecommender = ranker

	response := harness.expect("GET", "/api/v1/mart/recommendations/for-you?surface=clips", "", nil, 200)
	products := response["data"].(map[string]any)["products"].([]any)
	if len(products) != 1 || ranker.surface != "clips" {
		t.Fatalf("Clips should use its independent ranking context: products=%v surface=%q", products, ranker.surface)
	}
}

func TestProductRecommendationsRejectUnknownRankingSurface(t *testing.T) {
	harness := startHttpHarness(t)
	response := harness.expect("GET", "/api/v1/mart/recommendations/for-you?surface=untrusted", "", nil, 400)
	if response["error"] == nil {
		t.Fatalf("invalid recommendation surface should return a validation error: %v", response)
	}
}

func TestProductRecommendationsKeepVerifiedStoresFirstWhenRankerIsUnavailable(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("fallbackowner")
	unverifiedStore := harness.store(ownerId, "Unverified Store")
	verifiedStore := harness.store(ownerId, "Verified Store")
	if err := harness.client().Store.UpdateOneID(verifiedStore.ID).SetVerified(true).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	unverifiedProduct := harness.product(unverifiedStore, "Unverified Product", 1_000, true)
	verifiedProduct := harness.product(verifiedStore, "Verified Product", 1_000, true)
	harness.module.Container.ProductRecommender = &recordingProductRecommender{rankingError: errors.New("ranker unavailable")}

	response := harness.expect("GET", "/api/v1/mart/recommendations/for-you?surface=mart_home", "", nil, 200)
	data := response["data"].(map[string]any)
	products := data["products"].([]any)
	if len(products) != 2 || products[0].(map[string]any)["id"] != verifiedProduct.ID.String() {
		t.Fatalf("degraded Mart ranking should put the verified store first without hiding other sellers: %v", products)
	}
	if products[1].(map[string]any)["id"] != unverifiedProduct.ID.String() {
		t.Fatalf("eligible unverified products should remain available in the fallback: %v", products)
	}
}
