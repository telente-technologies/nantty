package services

import (
	"errors"
	"strings"
	"testing"
	"time"

	"nantty/modules/ads/src/types"
)

func ptr(value string) *string { return &value }

func installApp() *types.CreativeApp {
	return &types.CreativeApp{AppName: "Zudo", IosStoreUrl: "https://apps.apple.com/ng/app/zudo/id1", AndroidStoreUrl: "https://play.google.com/store/apps/details?id=com.zudo", WebFallbackUrl: "https://zudo.example/get"}
}

func TestSelectAppLinkByPlatform(t *testing.T) {
	app := installApp()
	cases := map[string]string{"ios": app.IosStoreUrl, "android": app.AndroidStoreUrl, "web": app.WebFallbackUrl, "": app.WebFallbackUrl}
	for platform, want := range cases {
		if got, ok := SelectAppLink(app, platform); !ok || got != want {
			t.Fatalf("platform %q: got %q ok=%v want %q", platform, got, ok, want)
		}
	}
	app.IosStoreUrl = ""
	if got, _ := SelectAppLink(app, "ios"); got != app.WebFallbackUrl {
		t.Fatalf("missing iOS link must fall back to web, got %q", got)
	}
	app.WebFallbackUrl = ""
	if _, ok := SelectAppLink(app, "web"); ok {
		t.Fatal("no web fallback means no link for other platforms")
	}
}

func TestStoreUrlAndDeepLinkValidation(t *testing.T) {
	if !ValidIosStoreUrl("https://apps.apple.com/ng/app/zudo/id1") || ValidIosStoreUrl("https://evil.example/app/x") || ValidIosStoreUrl("http://apps.apple.com/app/x") {
		t.Fatal("ios store url validation is wrong")
	}
	if !ValidAndroidStoreUrl("https://play.google.com/store/apps/details?id=com.zudo") || ValidAndroidStoreUrl("https://play.google.com/store/apps/details") || ValidAndroidStoreUrl("market://details?id=a") {
		t.Fatal("android store url validation is wrong")
	}
	for _, bad := range []string{"javascript://x", "https://zudo.example", "data://x", "zudo:/x", "zudo://a b"} {
		if ValidDeepLink(bad) {
			t.Fatalf("%q must not be a valid deep link", bad)
		}
	}
	if !ValidDeepLink("zudoapp://open/promo") {
		t.Fatal("custom scheme deep link should be valid")
	}
}

func TestResolveClickTargetUsesOnlyApprovedDestinations(t *testing.T) {
	creative := types.Creative{Type: "single", Destination: types.CreativeDestination{Type: "url", Url: ptr("https://shop.example/p?x=1"), Utm: &types.CreativeUtm{Campaign: "spring"}}}
	target, err := ResolveClickTarget(creative, 0, "web")
	if err != nil || !strings.HasPrefix(target, "https://shop.example/p?") || !strings.Contains(target, "utm_campaign=spring") || !strings.Contains(target, "utm_source=zudomart") || !strings.Contains(target, "x=1") {
		t.Fatalf("unexpected target %q err %v", target, err)
	}
	install := types.Creative{Type: "app_install", App: installApp(), Destination: types.CreativeDestination{Type: "app_store"}}
	if target, _ := ResolveClickTarget(install, 0, "android"); target != install.App.AndroidStoreUrl {
		t.Fatalf("android viewer got %q", target)
	}
	post := types.Creative{Type: "promoted_post", Destination: types.CreativeDestination{Type: "post", TargetId: ptr("p1")}}
	if target, _ := ResolveClickTarget(post, 0, "ios"); target != "zudomart://post/p1" {
		t.Fatalf("promoted post target %q", target)
	}
	broken := types.Creative{Destination: types.CreativeDestination{Type: "url", Url: ptr("http://insecure.example")}}
	if _, err := ResolveClickTarget(broken, 0, "web"); !errors.Is(err, ErrDestinationUnavailable) {
		t.Fatalf("non-https destination must be refused, got %v", err)
	}
	for _, hostile := range []string{"javascript:alert(1)", "//evil.example", "https://user:pw@evil.example"} {
		if _, err := ResolveClickTarget(types.Creative{Destination: types.CreativeDestination{Type: "url", Url: ptr(hostile)}}, 0, "web"); err == nil {
			t.Fatalf("%q must not resolve", hostile)
		}
	}
}

func TestCarouselClickResolvesPerCardAndRejectsBadIndex(t *testing.T) {
	creative := types.Creative{Type: "carousel", Cards: []types.CreativeCard{
		{Destination: types.CreativeDestination{Type: "url", Url: ptr("https://a.example/")}},
		{Destination: types.CreativeDestination{Type: "product", TargetId: ptr("prod-2")}},
	}}
	if target, _ := ResolveClickTarget(creative, 1, "web"); target != "zudomart://product/prod-2" {
		t.Fatalf("card 1 target %q", target)
	}
	for _, index := range []int{-1, 2, 99} {
		if _, err := ResolveClickTarget(creative, index, "web"); !errors.Is(err, ErrCardOutOfRange) {
			t.Fatalf("index %d must be refused, got %v", index, err)
		}
	}
}

func TestDestinationHostFlags(t *testing.T) {
	if flags := DestinationHostFlags("https://sub.bad.example/x", []string{"bad.example"}); len(flags) != 1 || flags[0].Severity != "CRITICAL" {
		t.Fatalf("blocked domain and subdomains must be critical: %+v", flags)
	}
	if len(DestinationHostFlags("https://bit.ly/abc", nil)) != 1 || len(DestinationHostFlags("https://10.0.0.1/", nil)) != 1 {
		t.Fatal("shorteners and raw IPs should be flagged")
	}
	if len(DestinationHostFlags("https://shop.example/", []string{"bad.example"})) != 0 {
		t.Fatal("clean host must pass")
	}
}

func TestClickTokenCannotBeForgedOrReusedAsImpressionToken(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	signer := newTestSigner(&now)
	token, err := signer.SignClick(ClickClaims{AdId: "ad-1", UserId: "u1", CardIndex: 2})
	if err != nil {
		t.Fatal(err)
	}
	claims, err := signer.VerifyClick(token)
	if err != nil || claims.CardIndex != 2 {
		t.Fatalf("round trip failed: %+v %v", claims, err)
	}
	if _, err := signer.Verify(token, "u1"); err == nil {
		t.Fatal("a click token must not verify as an impression token")
	}
	other, _ := signer.SignClick(ClickClaims{AdId: "ad-2", UserId: "u1", CardIndex: 0})
	a, b := strings.Split(token, "."), strings.Split(other, ".")
	if _, err := signer.VerifyClick(strings.Join([]string{a[0], a[1], b[2], a[3]}, ".")); err == nil {
		t.Fatal("payload swap must fail")
	}
	now = now.Add(2 * time.Hour)
	if _, err := signer.VerifyClick(token); err == nil {
		t.Fatal("expired click token must fail")
	}
}

func TestClickTargetsAreOnlyHttpsOrTheAppScheme(t *testing.T) {
	for _, safe := range []string{"https://shop.example.com/sale?utm_source=zudomart", "zudomart://product/p1", "zudomart://messages"} {
		if !IsSafeClickTarget(safe) {
			t.Fatalf("%q should be allowed", safe)
		}
	}
	for _, unsafe := range []string{"", "http://shop.example.com", "//evil.example.com", "javascript:alert(1)", "https://user:pass@evil.example.com", "zudomart://x\"><script>", "intent://evil"} {
		if IsSafeClickTarget(unsafe) {
			t.Fatalf("%q must be refused", unsafe)
		}
	}
}
