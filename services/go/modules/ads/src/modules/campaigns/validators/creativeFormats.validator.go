package validators

import (
	"fmt"
	"slices"
	"strings"

	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

var creativeTypes = []string{"single", "carousel", "app_install", "promoted_post"}

const (
	MinimumCarouselCards = 2
	MaximumCarouselCards = 10
)

func EffectiveCreativeType(input types.CreativeInput) string {
	if input.Type == "" {
		return "single"
	}
	return input.Type
}

func validateCreativeType(input types.CreativeInput, issues *Issues, path string) {
	creativeType := EffectiveCreativeType(input)
	if !slices.Contains(creativeTypes, creativeType) {
		issues.Add(path+".type", "Choose single, carousel, app install or promoted post.")
		return
	}
	if creativeType != "carousel" && len(input.Cards) > 0 {
		issues.Add(path+".cards", "Cards are only used by carousel ads.")
	}
	if creativeType != "app_install" && input.App != nil {
		issues.Add(path+".app", "App details are only used by app install ads.")
	}
	switch creativeType {
	case "carousel":
		validateCarousel(input, issues, path)
	case "app_install":
		validateAppInstall(input, issues, path)
		validateDestination(input.Destination, input.App, issues, path+".destination")
	case "promoted_post":
		validatePromotedPost(input, issues, path)
	default:
		validateDestination(input.Destination, input.App, issues, path+".destination")
	}
	if input.MediaClickable && creativeType == "carousel" {
		issues.Add(path+".mediaClickable", "Carousel cards are always clickable; set the destination on each card.")
	}
}

func validateCarousel(input types.CreativeInput, issues *Issues, path string) {
	if input.Format != "feed_post" {
		issues.Add(path+".format", "Carousel ads run in the feed only.")
	}
	if len(input.Cards) < MinimumCarouselCards || len(input.Cards) > MaximumCarouselCards {
		issues.Add(path+".cards", fmt.Sprintf("Add %d-%d cards.", MinimumCarouselCards, MaximumCarouselCards))
	}
	for index, card := range input.Cards {
		cardPath := fmt.Sprintf("%s.cards.%d", path, index)
		if strings.TrimSpace(card.MediaId) == "" {
			issues.Add(cardPath+".mediaId", "Add an image or video to this card.")
		}
		if headline := strings.TrimSpace(card.Headline); headline == "" || len(headline) > 40 {
			issues.Add(cardPath+".headline", "Write a card headline up to 40 characters.")
		}
		if len(card.Description) > 90 {
			issues.Add(cardPath+".description", "A card description can be at most 90 characters.")
		}
		if card.CallToAction != "" && !slices.Contains(callsToAct, card.CallToAction) {
			issues.Add(cardPath+".callToAction", "Choose a button.")
		}
		validateDestination(card.Destination, input.App, issues, cardPath+".destination")
	}
}

func validateAppInstall(input types.CreativeInput, issues *Issues, path string) {
	app := input.App
	if app == nil {
		issues.Add(path+".app", "Add the app details.")
		return
	}
	if name := strings.TrimSpace(app.AppName); name == "" || len(name) > 50 {
		issues.Add(path+".app.appName", "Enter the app name (up to 50 characters).")
	}
	if app.Rating != nil && (*app.Rating < 1 || *app.Rating > 5) {
		issues.Add(path+".app.rating", "A rating must be between 1 and 5.")
	}
	if app.IosStoreUrl != "" && !services.ValidIosStoreUrl(app.IosStoreUrl) {
		issues.Add(path+".app.iosStoreUrl", "Use an https://apps.apple.com/.../app/... link.")
	}
	if app.AndroidStoreUrl != "" && !services.ValidAndroidStoreUrl(app.AndroidStoreUrl) {
		issues.Add(path+".app.androidStoreUrl", "Use an https://play.google.com/store/apps/details?id=... link.")
	}
	if app.WebFallbackUrl != "" {
		if _, ok := services.ValidateHttpsUrl(app.WebFallbackUrl); !ok {
			issues.Add(path+".app.webFallbackUrl", "Use an https:// link without credentials.")
		}
	}
	if app.IosStoreUrl == "" && app.AndroidStoreUrl == "" {
		issues.Add(path+".app", "Add an App Store or Google Play link.")
	}
	if app.IosStoreUrl == "" || app.AndroidStoreUrl == "" {
		if app.WebFallbackUrl == "" {
			issues.Add(path+".app.webFallbackUrl", "Add a web link for viewers on other platforms.")
		}
	}
	for field, link := range map[string]string{"iosDeepLink": app.IosDeepLink, "androidDeepLink": app.AndroidDeepLink} {
		if link != "" && !services.ValidDeepLink(link) {
			issues.Add(path+".app."+field, "Use an app link like myapp://open, not a web link.")
		}
	}
	if input.Destination.Type != "app_store" {
		issues.Add(path+".destination.type", "App install ads lead to the app store.")
	}
}

func validatePromotedPost(input types.CreativeInput, issues *Issues, path string) {
	if input.Source.Type != "post" && input.Source.Type != "clip" {
		issues.Add(path+".source", "Promote an existing post or clip.")
	}
	if input.Destination.Type != "post" || deref(input.Destination.TargetId) != input.Source.Id {
		issues.Add(path+".destination", "A promoted post opens the post it boosts.")
	}
}

func validateDestination(destination types.CreativeDestination, app *types.CreativeApp, issues *Issues, path string) {
	if !slices.Contains(destinations, destination.Type) {
		issues.Add(path+".type", "Choose where the button leads.")
		return
	}
	switch destination.Type {
	case "url":
		if _, ok := services.ValidateHttpsUrl(deref(destination.Url)); !ok {
			issues.Add(path+".url", "Use an https:// link without credentials.")
		}
		if destination.Utm != nil && !validUtm(*destination.Utm) {
			issues.Add(path+".utm", "UTM values must be short and use letters, numbers, dashes or underscores.")
		}
	case "app_store":
		if app == nil {
			issues.Add(path+".type", "The app store destination needs app details.")
		}
	case "post", "store", "product", "profile":
		if deref(destination.TargetId) == "" {
			issues.Add(path+".targetId", "Choose the destination.")
		}
	}
}

func validUtm(utm types.CreativeUtm) bool {
	for _, value := range []string{utm.Source, utm.Medium, utm.Campaign, utm.Content, utm.Term} {
		if len(value) > 60 || strings.ContainsFunc(value, func(character rune) bool {
			return !(character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z' || character >= '0' && character <= '9' || character == '-' || character == '_' || character == '.')
		}) {
			return false
		}
	}
	return true
}
