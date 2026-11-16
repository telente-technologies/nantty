package listmarthighlights

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/modules/martFeatures/dtos"
	featureservices "nantty/modules/catalog/src/modules/martFeatures/services"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

type Query struct {
	Viewer *uuid.UUID
	Cursor string
	Limit  int
}

type Handler struct {
	Container *container.Container
}

var collectionHighlights = map[string]struct{ kind, name, code, label string }{
	"sales_of_the_day": {"deals_of_the_day", "Sales of the day", "time_sensitive", "Ends soon"},
	"new_arrivals":     {"new_arrivals", "New arrivals", "fresh_listings", "Just listed"},
	"featured_brands":  {"featured_brands", "Featured brands", "followed_brands", "Brands on Nantty"},
}

var editorialOrder = []string{"sales_of_the_day", "new_arrivals", "featured_brands"}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.MartHighlight], error) {
	offset := 0
	if parts, err := utils.DecodeCursor(query.Cursor, 1); err != nil {
		return httpserver.CursorPage[dtos.MartHighlight]{}, err
	} else if parts != nil {
		if offset, err = strconv.Atoi(parts[0]); err != nil || offset < 0 {
			return httpserver.CursorPage[dtos.MartHighlight]{}, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
		}
	}
	country := services.ViewerCountry(ctx, handler.Container, query.Viewer)
	highlights, err := handler.candidates(ctx, country)
	if err != nil {
		return httpserver.CursorPage[dtos.MartHighlight]{}, err
	}
	for index := range highlights {
		highlights[index].Ranking.Score = float64(len(highlights)-index) / float64(len(highlights))
	}
	start, end := min(offset, len(highlights)), min(offset+query.Limit, len(highlights))
	nextCursor := ""
	if end < len(highlights) {
		nextCursor = utils.EncodeCursor(strconv.Itoa(end))
	}
	page := highlights[start:end]
	if offset == 0 && query.Viewer != nil {
		request := interfaces.MartAdRequest{Viewer: *query.Viewer, Country: country}
		page = InsertSponsoredHighlight(page, BuildSponsoredHighlight(ctx, handler.Container.MartAds, request, handler.listedProductName, handler.Container.Logger))
	}
	return httpserver.NewCursorPage(page, nextCursor), nil
}

func (handler Handler) candidates(ctx context.Context, country string) ([]dtos.MartHighlight, error) {
	features, err := featureservices.LiveFeatures(ctx, handler.Container, country)
	if err != nil {
		return nil, err
	}
	highlights := []dtos.MartHighlight{}
	seen := map[string]bool{}
	for _, row := range features {
		imageUrl, found := featureservices.ImageUrlOf(handler.Container.Settings, row.ImageID)
		var image *string
		if found {
			image = &imageUrl
		}
		highlight, ok := handler.fromTarget(ctx, row.ID.String(), row.Title, row.Subtitle, image, row.TargetType, row.TargetValue)
		if ok && !seen[row.TargetType+row.TargetValue] {
			seen[row.TargetType+row.TargetValue] = true
			highlights = append(highlights, highlight)
		}
	}
	for _, collection := range editorialOrder {
		if !seen["COLLECTION"+collection] {
			preset := collectionHighlights[collection]
			highlight, _ := handler.fromTarget(ctx, "editorial-"+collection, preset.name, nil, nil, "COLLECTION", collection)
			highlights = append(highlights, highlight)
		}
	}
	return highlights, nil
}

func (handler Handler) fromTarget(ctx context.Context, id, title string, subtitle, imageUrl *string, targetType, targetValue string) (dtos.MartHighlight, bool) {
	highlight := dtos.MartHighlight{Id: id, Title: title, Subtitle: subtitle, ImageUrl: imageUrl}
	switch targetType {
	case "COLLECTION":
		preset, known := collectionHighlights[targetValue]
		if !known {
			return highlight, false
		}
		highlight.Kind = preset.kind
		highlight.Target = map[string]any{"type": "collection", "collection": targetValue, "name": preset.name}
		highlight.Ranking.Reason = dtos.HighlightReason{Code: preset.code, Label: preset.label}
		return highlight, true
	case "CATEGORY":
		categoryId, err := uuid.Parse(targetValue)
		if err != nil {
			return highlight, false
		}
		row, err := handler.Container.Client.Category.Query().Where(category.ID(categoryId), category.StoreIDIsNil(), category.Active(true)).Only(ctx)
		if err != nil {
			return highlight, false
		}
		highlight.Kind = "category_spotlight"
		highlight.Target = map[string]any{"type": "category", "categoryId": row.ID.String(), "name": row.Name}
		highlight.Ranking.Reason = dtos.HighlightReason{Code: "trending_nearby", Label: "Popular near you"}
		return highlight, true
	}
	return highlight, false
}
