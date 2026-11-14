package developerorganizations

import (
	"regexp"
	"strings"
)

var organizationSlugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func validateCreateRequest(request CreateRequest) error {
	name := strings.TrimSpace(request.Name)
	if len(name) < 2 || len(name) > 80 {
		return errInvalidName
	}
	if len(request.Slug) < 3 || len(request.Slug) > 48 || !organizationSlugPattern.MatchString(request.Slug) {
		return errInvalidSlug
	}
	return nil
}
