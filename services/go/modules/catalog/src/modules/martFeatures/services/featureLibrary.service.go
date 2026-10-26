package services

import (
	"encoding/json"
	"strings"

	"nantty/modules/catalog/src/configs"
	"nantty/modules/catalog/src/modules/martFeatures/dtos"
)

var developmentLibrary = []struct{ id, label string }{
	{"hero-fashion", "Fashion hero"}, {"hero-gadgets", "Gadgets hero"}, {"promo-beauty", "Beauty promo"}, {"promo-home", "Home promo"},
}

func ImageLibrary(settings configs.CatalogSettings) []dtos.LibraryImage {
	library := []dtos.LibraryImage{}
	if strings.TrimSpace(settings.MartImageLibrary) != "" {
		if json.Unmarshal([]byte(settings.MartImageLibrary), &library) == nil {
			return library
		}
		return []dtos.LibraryImage{}
	}
	if settings.IsProduction() {
		return library
	}
	base := strings.TrimRight(settings.MediaPublicBaseUrl, "/")
	for _, image := range developmentLibrary {
		library = append(library, dtos.LibraryImage{Id: image.id, Label: image.label, Url: base + "/mart/" + image.id + ".jpg"})
	}
	return library
}

func ImageUrlOf(settings configs.CatalogSettings, imageId string) (string, bool) {
	for _, image := range ImageLibrary(settings) {
		if image.Id == imageId {
			return image.Url, true
		}
	}
	return "", false
}
