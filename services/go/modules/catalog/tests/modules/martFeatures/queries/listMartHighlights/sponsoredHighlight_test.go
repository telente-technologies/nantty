package listmarthighlights_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/modules/martFeatures/dtos"
	listmarthighlights "nantty/modules/catalog/src/modules/martFeatures/queries/listMartHighlights"
)

type fakeMartAds struct {
	ad      *interfaces.MartAd
	err     error
	request interfaces.MartAdRequest
}

func (fake *fakeMartAds) DecideMartTile(_ context.Context, request interfaces.MartAdRequest) (*interfaces.MartAd, error) {
	fake.request = request
	return fake.ad, fake.err
}

var listedProduct = uuid.MustParse("0190f0a0-0000-7000-8000-000000000001")

func productNames(_ context.Context, productId uuid.UUID) (string, bool) {
	return "Adire two-piece set", productId == listedProduct
}

func editorialPage() []dtos.MartHighlight {
	return []dtos.MartHighlight{{Id: "editorial-sales_of_the_day", Kind: "deals_of_the_day", Ranking: dtos.HighlightRanking{Score: 1}}, {Id: "editorial-new_arrivals", Kind: "new_arrivals", Ranking: dtos.HighlightRanking{Score: 0.5}}}
}

func TestSponsoredHighlightCarriesTheProductAndTracking(t *testing.T) {
	viewer := uuid.New()
	decider := &fakeMartAds{ad: &interfaces.MartAd{AdId: "ad_1", ImpressionToken: "imp_1", Label: "Sponsored", AdvertiserName: "Adaeze Styles", ProductId: listedProduct.String(), PrimaryText: "Hand-dyed in Abeokuta", CallToAction: "Shop now", AdType: "single", ImageUrl: "https://cdn.example/ad.jpg", ClickLinks: &interfaces.MartAdClickLinks{Cta: "https://ads.example/c/1"}}}
	highlight := listmarthighlights.BuildSponsoredHighlight(context.Background(), decider, interfaces.MartAdRequest{Viewer: viewer, Country: "NG"}, productNames, nil)
	if highlight == nil {
		t.Fatal("expected a sponsored tile")
	}
	if decider.request.Country != "NG" || decider.request.Viewer != viewer {
		t.Fatalf("decider got %+v", decider.request)
	}
	if highlight.Kind != "boosted_product" || highlight.Target["type"] != "product" || highlight.Target["productId"] != listedProduct.String() || highlight.Title != "Adire two-piece set" {
		t.Fatalf("unexpected tile %+v", highlight)
	}
	if highlight.Ranking.Reason.Code != "sponsored" || highlight.Sponsored == nil || highlight.Sponsored.AdvertiserName != "Adaeze Styles" || highlight.Sponsored.ImpressionToken != "imp_1" || highlight.Sponsored.CampaignId != "ad_1" || highlight.Sponsored.ClickLinks.Cta == "" {
		t.Fatalf("sponsored disclosure or tracking missing: %+v", highlight.Sponsored)
	}
}

func TestSponsoredHighlightIsDroppedWhenAdsAreDownOrTheAdIsUnusable(t *testing.T) {
	request := interfaces.MartAdRequest{Viewer: uuid.New(), Country: "GH"}
	cases := map[string]interfaces.MartAdDecider{
		"ads down":         &fakeMartAds{err: errors.New("connection refused")},
		"no fill":          &fakeMartAds{},
		"not a product":    &fakeMartAds{ad: &interfaces.MartAd{AdId: "ad_2", ImpressionToken: "imp_2", ProductId: "post_9"}},
		"product unlisted": &fakeMartAds{ad: &interfaces.MartAd{AdId: "ad_3", ImpressionToken: "imp_3", ProductId: uuid.NewString()}},
		"no token":         &fakeMartAds{ad: &interfaces.MartAd{AdId: "ad_4", ProductId: listedProduct.String()}},
		"not configured":   nil,
	}
	for name, decider := range cases {
		if highlight := listmarthighlights.BuildSponsoredHighlight(context.Background(), decider, request, productNames, nil); highlight != nil {
			t.Fatalf("%s: expected editorial only, got %+v", name, highlight)
		}
		if page := listmarthighlights.InsertSponsoredHighlight(editorialPage(), listmarthighlights.BuildSponsoredHighlight(context.Background(), decider, request, productNames, nil)); len(page) != 2 {
			t.Fatalf("%s: page changed to %d items", name, len(page))
		}
	}
}

func TestInsertSponsoredPlacesTheTileSecond(t *testing.T) {
	page := listmarthighlights.InsertSponsoredHighlight(editorialPage(), &dtos.MartHighlight{Id: "sponsored-ad_1", Kind: "boosted_product"})
	if len(page) != 3 || page[1].Kind != "boosted_product" || page[0].Id != "editorial-sales_of_the_day" || page[2].Id != "editorial-new_arrivals" {
		t.Fatalf("unexpected order %+v", page)
	}
	if only := listmarthighlights.InsertSponsoredHighlight(nil, &dtos.MartHighlight{Id: "sponsored-ad_1"}); len(only) != 1 {
		t.Fatalf("empty page should hold just the tile, got %d", len(only))
	}
}
