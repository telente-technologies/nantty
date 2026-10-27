package validators

import (
	"fmt"
	"strings"
	"testing"

	"nantty/modules/ads/src/types"
)

func str(value string) *string { return &value }

func cardsOf(count int) []types.CreativeCardInput {
	cards := make([]types.CreativeCardInput, 0, count)
	for index := 0; index < count; index++ {
		cards = append(cards, types.CreativeCardInput{MediaId: fmt.Sprintf("m%d", index), Headline: "Card", Destination: types.CreativeDestination{Type: "url", Url: str("https://shop.example/c")}})
	}
	return cards
}

func carouselWith(count int) types.CreativeInput {
	return types.CreativeInput{Format: "feed_post", Type: "carousel", Source: types.CreativeSource{Type: "upload", Id: "u"}, Headline: "Sale", CallToAction: "shop_now", Cards: cardsOf(count)}
}

func issuePaths(input types.CreativeInput) string {
	issues := NewIssues("")
	ValidateCreativeInput(input, nil, issues, "c")
	var paths []string
	for _, item := range issues.items {
		paths = append(paths, item.Path)
	}
	return strings.Join(paths, ",")
}

func TestCarouselNeedsTwoToTenCards(t *testing.T) {
	for _, count := range []int{0, 1, 11} {
		if !strings.Contains(issuePaths(carouselWith(count)), "c.cards") {
			t.Fatalf("%d cards must be rejected", count)
		}
	}
	for _, count := range []int{2, 10} {
		if paths := issuePaths(carouselWith(count)); paths != "" {
			t.Fatalf("%d cards must pass, got %s", count, paths)
		}
	}
}

func TestCarouselCardFieldsAreValidated(t *testing.T) {
	input := carouselWith(2)
	input.Cards[1] = types.CreativeCardInput{Headline: strings.Repeat("x", 41), Destination: types.CreativeDestination{Type: "url", Url: str("http://insecure.example")}}
	paths := issuePaths(input)
	for _, want := range []string{"c.cards.1.mediaId", "c.cards.1.headline", "c.cards.1.destination.url"} {
		if !strings.Contains(paths, want) {
			t.Fatalf("missing %s in %s", want, paths)
		}
	}
	clip := carouselWith(2)
	clip.Format = "clip"
	if !strings.Contains(issuePaths(clip), "c.format") {
		t.Fatal("carousel outside the feed must be rejected")
	}
}

func appInstall() types.CreativeInput {
	return types.CreativeInput{Format: "feed_post", Type: "app_install", Source: types.CreativeSource{Type: "upload", Id: "u"}, Headline: "Get Nantty", CallToAction: "install",
		Destination: types.CreativeDestination{Type: "app_store"},
		App:         &types.CreativeApp{AppName: "Nantty", IosStoreUrl: "https://apps.apple.com/ng/app/nantty/id1", AndroidStoreUrl: "https://play.google.com/store/apps/details?id=com.nantty", IosDeepLink: "nantty://open"}}
}

func TestAppInstallStoreLinksAreValidated(t *testing.T) {
	if paths := issuePaths(appInstall()); paths != "" {
		t.Fatalf("valid app install rejected: %s", paths)
	}
	bad := appInstall()
	bad.App.IosStoreUrl = "https://evil.example/app/1"
	bad.App.AndroidStoreUrl = "https://play.google.com/store/apps/details"
	bad.App.IosDeepLink = "javascript://x"
	paths := issuePaths(bad)
	for _, want := range []string{"c.app.iosStoreUrl", "c.app.androidStoreUrl", "c.app.iosDeepLink"} {
		if !strings.Contains(paths, want) {
			t.Fatalf("missing %s in %s", want, paths)
		}
	}
	single := appInstall()
	single.App.AndroidStoreUrl = ""
	if !strings.Contains(issuePaths(single), "webFallbackUrl") {
		t.Fatal("one store link needs a web fallback")
	}
}

func TestPromotedPostMustOpenItsOwnPost(t *testing.T) {
	input := types.CreativeInput{Format: "feed_post", Type: "promoted_post", Source: types.CreativeSource{Type: "post", Id: "p1"}, Headline: "Boost", CallToAction: "watch_more", Destination: types.CreativeDestination{Type: "post", TargetId: str("p1")}}
	if paths := issuePaths(input); paths != "" {
		t.Fatalf("valid promoted post rejected: %s", paths)
	}
	input.Destination.TargetId = str("other")
	if !strings.Contains(issuePaths(input), "c.destination") {
		t.Fatal("a promoted post may not lead elsewhere")
	}
}
