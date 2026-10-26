package validators

import (
	"net/url"
	"regexp"

	"nantty/modules/catalog/src/modules/stores/dtos"
	"nantty/modules/catalog/src/utils"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$`)

func ValidateCreateStore(body dtos.CreateStoreRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("businessProfileId", body.BusinessProfileId, &collected)
	collected.CheckLength("name", body.Name, 2, 80)
	if body.Slug != nil && !slugPattern.MatchString(*body.Slug) {
		collected.Add("slug", "must be 3-50 lowercase letters, digits or hyphens")
	}
	if len(body.Description) > 1000 {
		collected.Add("description", "must be at most 1000 characters")
	}
	if body.CountryCode != nil && len(*body.CountryCode) != 2 {
		collected.Add("countryCode", "must be a two-letter code")
	}
	return collected.AsError()
}

func ValidateUpdateStore(body dtos.UpdateStoreRequest) error {
	var collected utils.Issues
	if body.Name != nil {
		collected.CheckLength("name", *body.Name, 2, 80)
	}
	if body.Description != nil && len(*body.Description) > 1000 {
		collected.Add("description", "must be at most 1000 characters")
	}
	for path, value := range map[string]*string{"logoUrl": body.LogoUrl, "bannerUrl": body.BannerUrl} {
		if value != nil && *value != "" {
			if parsed, err := url.Parse(*value); err != nil || parsed.Scheme != "https" || len(*value) > 500 {
				collected.Add(path, "must be an https link")
			}
		}
	}
	return collected.AsError()
}

func ValidateStoreStatus(request dtos.StoreStatusRequest) error {
	issues := utils.Issues{}
	if request.Status != "active" && request.Status != "suspended" {
		issues.Add("status", "must be active or suspended")
	}
	issues.CheckLength("reason", request.Reason, 5, 1000)
	return issues.AsError()
}
