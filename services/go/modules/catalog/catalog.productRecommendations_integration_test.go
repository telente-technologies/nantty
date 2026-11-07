package catalog

import (
	"context"
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
	candidates []interfaces.ProductRankingCandidate,
) ([]string, error) {
	recommender.personalizationAllowed = personalizationAllowed
	recommender.candidateIds = make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		recommender.candidateIds = append(recommender.candidateIds, candidate.ProductId)
	}
	return recommender.orderedIds, nil
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
	response := harness.expect("GET", "/api/v1/mart/recommendations/for-you", token, nil, 200)
	data := response["data"].(map[string]any)
	products := data["products"].([]any)
	if len(products) != 2 || products[0].(map[string]any)["id"] != recalled.ID.String() {
		t.Fatalf("consented item-affinity recall should be considered ahead of popular candidates: %v", products)
	}
	if !ranker.personalizationAllowed {
		t.Fatal("explicitly consented viewer should permit personalized candidate recall")
	}
}
