package getrecommendedproducts

import (
	"context"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/store"
	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/modules/products/queries/listProducts"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
)

const (
	maximumRecommendationCandidates      = 100
	personalizedRecommendationCandidates = 50
	popularRecommendationCandidates      = 70
	recentRecommendationCandidates       = maximumRecommendationCandidates - popularRecommendationCandidates
)

var recommendationTopicPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)

type Handler struct {
	Container *container.Container
}

type RecommendedProducts struct {
	Products []types.ProductSummaryView `json:"products"`
	Source   string                     `json:"source"`
}

func (handler Handler) Execute(ctx context.Context, viewer *uuid.UUID) (RecommendedProducts, error) {
	country := services.ViewerCountry(ctx, handler.Container, viewer)
	personalizationAllowed := false
	var viewerId uuid.UUID
	if viewer != nil {
		viewerId = *viewer
		choices, found, lookupError := handler.Container.Users.PrivacyChoicesOf(ctx, *viewer)
		if lookupError != nil {
			return RecommendedProducts{}, lookupError
		}
		personalizationAllowed = found && choices.Personalization
	}

	var recalledRows []*ent.Product
	if personalizationAllowed && handler.Container.ProductRecommender != nil {
		if recalledIds, recallError := handler.Container.ProductRecommender.RecallProductIds(
			ctx, viewerId, true, personalizedRecommendationCandidates,
		); recallError == nil && len(recalledIds) > 0 {
			eligibleRows, loadError := handler.loadEligibleRows(ctx, viewer, country, recalledIds)
			if loadError != nil {
				return RecommendedProducts{}, loadError
			}
			recalledRows = orderProductsByIds(eligibleRows, recalledIds)
		}
	}

	conditions := services.WithRegionCondition(listproducts.PublicListingConditions(), country, viewer)
	popularRows, err := handler.Container.Client.Product.Query().Where(conditions...).
		Order(ent.Desc(product.FieldUnitsSold), ent.Desc(product.FieldID)).Limit(popularRecommendationCandidates).All(ctx)
	if err != nil {
		return RecommendedProducts{}, err
	}
	recentRows, err := handler.Container.Client.Product.Query().Where(conditions...).
		Order(ent.Desc(product.FieldPublishedAt), ent.Desc(product.FieldID)).Limit(recentRecommendationCandidates).All(ctx)
	if err != nil {
		return RecommendedProducts{}, err
	}
	rows := make([]*ent.Product, 0, maximumRecommendationCandidates)
	seenProducts := make(map[uuid.UUID]bool, maximumRecommendationCandidates)
	for _, row := range append(recalledRows, append(popularRows, recentRows...)...) {
		if !seenProducts[row.ID] && len(rows) < maximumRecommendationCandidates {
			seenProducts[row.ID] = true
			rows = append(rows, row)
		}
	}
	if len(rows) == 0 {
		return RecommendedProducts{Products: []types.ProductSummaryView{}, Source: "popular"}, nil
	}

	products, err := services.LoadProductSummaries(ctx, handler.Container, rows, viewer)
	if err != nil {
		return RecommendedProducts{}, err
	}
	productById := make(map[string]*ent.Product, len(rows))
	productViewById := make(map[string]types.ProductSummaryView, len(products))
	for _, row := range rows {
		productById[row.ID.String()] = row
	}
	for _, view := range products {
		productViewById[view.Id] = view
	}

	storeIds := make([]uuid.UUID, 0, len(rows))
	seenStores := make(map[uuid.UUID]bool, len(rows))
	for _, row := range rows {
		if !seenStores[row.StoreID] {
			seenStores[row.StoreID] = true
			storeIds = append(storeIds, row.StoreID)
		}
	}
	storeRows, err := handler.Container.Client.Store.Query().Where(store.IDIn(storeIds...)).All(ctx)
	if err != nil {
		return RecommendedProducts{}, err
	}
	storesById := make(map[uuid.UUID]*ent.Store, len(storeRows))
	for _, row := range storeRows {
		storesById[row.ID] = row
	}

	candidates := make([]interfaces.ProductRankingCandidate, 0, len(rows))
	fallbackIds := make([]string, 0, len(rows))
	for _, row := range rows {
		view, hasView := productViewById[row.ID.String()]
		storeRow := storesById[row.StoreID]
		if !hasView || view.Stock <= 0 || storeRow == nil {
			continue
		}
		categoryId := ""
		if row.CategoryID != nil {
			categoryId = row.CategoryID.String()
		}
		rating := 0.0
		if row.RatingCount > 0 {
			rating = float64(row.RatingSum) / float64(row.RatingCount)
		}
		candidates = append(candidates, interfaces.ProductRankingCandidate{
			ProductId: row.ID.String(), StoreId: row.StoreID.String(), CategoryId: categoryId,
			Topics: recommendationTopics(row.Tags), PriceMinor: row.MinPriceMinor, Currency: row.Currency,
			Rating: rating, SalesCount: row.UnitsSold, Country: storeRow.CountryCode,
			StoreVerified: storeRow.Verified, InStock: true,
		})
		if len(fallbackIds) < 20 {
			fallbackIds = append(fallbackIds, row.ID.String())
		}
	}
	if len(candidates) == 0 {
		return RecommendedProducts{Products: []types.ProductSummaryView{}, Source: "popular"}, nil
	}

	orderedIds := fallbackIds
	source := "popular"
	if personalizationAllowed && len(fallbackIds) > 0 && len(recalledRows) > 0 {
		source = "personalized"
	}
	if handler.Container.ProductRecommender != nil {
		if rankedIds, rankError := handler.Container.ProductRecommender.RankProducts(ctx, viewerId, personalizationAllowed, country, candidates); rankError == nil {
			validated := retainKnownUniqueProductIds(rankedIds, productById)
			if len(validated) > 0 {
				orderedIds = validated
				if personalizationAllowed {
					source = "personalized"
				}
			}
		}
	}

	// Re-read the ranked ids against public listing, regional shipping, and current stock before returning them.
	validatedRows, err := handler.loadEligibleRows(ctx, viewer, country, orderedIds)
	if err != nil {
		return RecommendedProducts{}, err
	}
	if len(validatedRows) == 0 {
		return RecommendedProducts{Products: []types.ProductSummaryView{}, Source: "popular"}, nil
	}
	validatedViews, err := services.LoadProductSummaries(ctx, handler.Container, validatedRows, viewer)
	if err != nil {
		return RecommendedProducts{}, err
	}
	viewsById := make(map[string]types.ProductSummaryView, len(validatedViews))
	for _, view := range validatedViews {
		if view.Stock > 0 {
			viewsById[view.Id] = view
		}
	}
	result := make([]types.ProductSummaryView, 0, len(orderedIds))
	for _, productId := range orderedIds {
		if view, found := viewsById[productId]; found {
			result = append(result, view)
		}
	}
	return RecommendedProducts{Products: result, Source: source}, nil
}

func orderProductsByIds(rows []*ent.Product, ids []string) []*ent.Product {
	byId := make(map[string]*ent.Product, len(rows))
	for _, row := range rows {
		byId[row.ID.String()] = row
	}
	ordered := make([]*ent.Product, 0, len(rows))
	for _, id := range ids {
		if row := byId[id]; row != nil {
			ordered = append(ordered, row)
		}
	}
	return ordered
}

func (handler Handler) loadEligibleRows(ctx context.Context, viewer *uuid.UUID, country string, ids []string) ([]*ent.Product, error) {
	parsed := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if parsedId, err := uuid.Parse(id); err == nil {
			parsed = append(parsed, parsedId)
		}
	}
	if len(parsed) == 0 {
		return []*ent.Product{}, nil
	}
	conditions := services.WithRegionCondition(listproducts.PublicListingConditions(), country, viewer)
	conditions = append(conditions, product.IDIn(parsed...))
	return handler.Container.Client.Product.Query().Where(conditions...).All(ctx)
}

func retainKnownUniqueProductIds(ids []string, known map[string]*ent.Product) []string {
	result := make([]string, 0, len(ids))
	seen := make(map[string]bool, len(ids))
	for _, id := range ids {
		if _, exists := known[id]; exists && !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}

func recommendationTopics(tags []string) []string {
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		slug := strings.ToLower(strings.TrimSpace(tag))
		slug = strings.ReplaceAll(slug, " ", "_")
		if recommendationTopicPattern.MatchString(slug) && !slices.Contains(result, slug) {
			result = append(result, slug)
		}
		if len(result) == 20 {
			break
		}
	}
	return result
}
