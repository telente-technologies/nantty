package validators

import (
	"net/url"
	"regexp"
	"strings"

	"zudomart/modules/catalog/src/modules/brands/dtos"
	"zudomart/modules/catalog/src/utils"
)

var handlePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$`)

func checkHttpsUrl(path string, value *string, issues *utils.Issues) {
	if value == nil || *value == "" {
		return
	}
	parsed, err := url.Parse(*value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || len(*value) > 500 {
		issues.Add(path, "must be an https:// address")
	}
}

func ValidateCreateBrand(request dtos.CreateBrandRequest) error {
	issues := utils.Issues{}
	issues.CheckLength("name", request.Name, 2, 80)
	if !handlePattern.MatchString(strings.ToLower(strings.TrimPrefix(request.Handle, "@"))) {
		issues.Add("handle", "Use 3-40 letters, numbers, dots, dashes or underscores.")
	}
	utils.ParseIdentifier("categoryId", request.CategoryId, &issues)
	if len(request.Description) > 1000 {
		issues.Add("description", "must be at most 1000 characters")
	}
	checkHttpsUrl("logoUrl", request.LogoUrl, &issues)
	checkHttpsUrl("coverUrl", request.CoverUrl, &issues)
	if request.Website != nil && len(*request.Website) > 200 {
		issues.Add("website", "must be at most 200 characters")
	} else {
		checkHttpsUrl("website", request.Website, &issues)
	}
	return issues.AsError()
}

func ValidateDecision(request dtos.OfficialDecisionRequest) error {
	issues := utils.Issues{}
	issues.CheckLength("reason", request.Reason, 5, 1000)
	return issues.AsError()
}
