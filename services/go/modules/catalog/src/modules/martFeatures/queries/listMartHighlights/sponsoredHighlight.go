package listmarthighlights

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/modules/martFeatures/dtos"
	"nantty/modules/catalog/src/services"
)

const sponsoredSlotIndex = 1

type listedProductName func(ctx context.Context, productId uuid.UUID) (string, bool)

func (handler Handler) listedProductName(ctx context.Context, productId uuid.UUID) (string, bool) {
	row, err := handler.Container.Client.Product.Query().Where(product.ID(productId), product.Status(enums.ProductActive), product.PublishedOnline(true), product.Visibility(enums.VisibilityPublic),
		product.ModerationVisibilityIn(enums.ModerationVisible, enums.ModerationRestricted), services.ListedStoreCondition()).Only(ctx)
	if err != nil {
		return "", false
	}
	return row.Name, true
}

func sponsoredHighlight(ctx context.Context, decider interfaces.MartAdDecider, request interfaces.MartAdRequest, productName listedProductName, logger *slog.Logger) *dtos.MartHighlight {
	if decider == nil {
		return nil
	}
	ad, err := decider.DecideMartTile(ctx, request)
	if err != nil {
		if logger != nil {
			logger.WarnContext(ctx, "mart sponsored tile skipped: ads decision failed", "error", err)
		}
		return nil
	}
	if ad == nil || ad.AdId == "" || ad.ImpressionToken == "" {
		return nil
	}
	productId, err := uuid.Parse(ad.ProductId)
	if err != nil {
		return nil
	}
	name, listed := productName(ctx, productId)
	if !listed {
		return nil
	}
	label := "Sponsored"
	if ad.Label == "Promoted" {
		label = ad.Label
	}
	title := ad.Headline
	if title == "" {
		title = name
	}
	highlight := &dtos.MartHighlight{
		Id: "sponsored-" + ad.AdId, Kind: "boosted_product", Title: title,
		Target:  map[string]any{"type": "product", "productId": productId.String(), "name": name},
		Ranking: dtos.HighlightRanking{Reason: dtos.HighlightReason{Code: "sponsored", Label: label}},
		Sponsored: &dtos.SponsoredPlacement{
			CampaignId: ad.AdId, Label: label, AdvertiserName: ad.AdvertiserName, CtaLabel: ad.CallToAction, AdType: ad.AdType,
			ImpressionToken: ad.ImpressionToken, ClickLinks: ad.ClickLinks,
		},
	}
	if ad.PrimaryText != "" {
		subtitle := ad.PrimaryText
		highlight.Subtitle = &subtitle
	}
	if ad.ImageUrl != "" {
		imageUrl := ad.ImageUrl
		highlight.ImageUrl = &imageUrl
	}
	return highlight
}

func insertSponsored(page []dtos.MartHighlight, sponsored *dtos.MartHighlight) []dtos.MartHighlight {
	if sponsored == nil {
		return page
	}
	position := min(sponsoredSlotIndex, len(page))
	if len(page) > 0 {
		sponsored.Ranking.Score = page[min(position, len(page)-1)].Ranking.Score
	}
	merged := make([]dtos.MartHighlight, 0, len(page)+1)
	merged = append(merged, page[:position]...)
	merged = append(merged, *sponsored)
	return append(merged, page[position:]...)
}
