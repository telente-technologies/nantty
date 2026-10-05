package validators

import (
	"regexp"
	"slices"
	"strconv"
	"strings"

	"zudomart/modules/ads/src/modules/audiences/dtos"
	"zudomart/modules/ads/src/modules/audiences/services"
	"zudomart/platform/httpserver"
)

const MaximumCustomerListRows = 50_000

var (
	sha256Hex         = regexp.MustCompile(`^[0-9a-f]{64}$`)
	engagementSources = []string{"any_post", "clips_watched", "live_viewers", "saved_products", "messaged"}
	retentionOptions  = []int{7, 14, 30, 60, 90, 180}
)

func issue(path, message string) httpserver.ValidationIssue {
	return httpserver.ValidationIssue{Path: path, Message: message}
}

func fail(issues []httpserver.ValidationIssue) error {
	if len(issues) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(issues)
}

func validateName(name string) []httpserver.ValidationIssue {
	if trimmed := strings.TrimSpace(name); trimmed == "" || len(trimmed) > 120 {
		return []httpserver.ValidationIssue{issue("name", "Name must be 1-120 characters.")}
	}
	return nil
}

func ValidateRename(request dtos.RenameRequest) error { return fail(validateName(request.Name)) }

func ValidateCreate(request dtos.CreateAudienceRequest) error {
	issues := validateName(request.Name)
	switch request.Type {
	case "store_customers":
		issues = append(issues, validateRetention(request.RetentionDays)...)
		if request.MinimumOrders == nil || *request.MinimumOrders < 1 || *request.MinimumOrders > 50 {
			issues = append(issues, issue("minimumOrders", "Minimum orders must be 1-50."))
		}
	case "engagers":
		issues = append(issues, validateRetention(request.RetentionDays)...)
		if !slices.Contains(engagementSources, request.EngagementSource) {
			issues = append(issues, issue("engagementSource", "Choose an engagement source."))
		}
	case "followers":
	case "lookalike":
		if request.SourceAudienceId == "" {
			issues = append(issues, issue("sourceAudienceId", "Choose a source audience."))
		}
		if len(request.CountryCode) != 2 {
			issues = append(issues, issue("countryCode", "Choose a country."))
		}
		if request.SimilarityPercent == nil || *request.SimilarityPercent < 1 || *request.SimilarityPercent > 10 {
			issues = append(issues, issue("similarityPercent", "Similarity must be 1-10."))
		}
	default:
		issues = append(issues, issue("type", "Choose store_customers, engagers, followers or lookalike."))
	}
	return fail(issues)
}

func validateRetention(days *int) []httpserver.ValidationIssue {
	if days == nil || !slices.Contains(retentionOptions, *days) {
		return []httpserver.ValidationIssue{issue("retentionDays", "Retention must be 7, 14, 30, 60, 90 or 180 days.")}
	}
	return nil
}

func ValidateCustomerList(request dtos.CustomerListRequest) ([]string, error) {
	issues := validateName(request.Name)
	if request.IdentifierType != "email" && request.IdentifierType != "phone" {
		issues = append(issues, issue("identifierType", "Choose email or phone."))
	}
	if request.HashAlgorithm != "sha256" {
		issues = append(issues, issue("hashAlgorithm", "Only sha256 is supported."))
	}
	if len(request.HashedIdentifiers) < 1 || len(request.HashedIdentifiers) > MaximumCustomerListRows {
		issues = append(issues, issue("hashedIdentifiers", "Send 1-50,000 rows per request."))
		return nil, fail(issues)
	}
	unique := make(map[string]struct{}, len(request.HashedIdentifiers))
	for index, hash := range request.HashedIdentifiers {
		if !sha256Hex.MatchString(hash) {
			issues = append(issues, issue("hashedIdentifiers."+strconv.Itoa(index), "Every row must be a 64-character lowercase SHA-256 hex digest."))
			break
		}
		unique[hash] = struct{}{}
	}
	if len(issues) > 0 {
		return nil, fail(issues)
	}
	hashes := make([]string, 0, len(unique))
	for hash := range unique {
		hashes = append(hashes, hash)
	}
	return hashes, nil
}

func ValidateEstimate(request dtos.EstimateRequest) error {
	var issues []httpserver.ValidationIssue
	if !services.IsKnownObjective(request.Objective) {
		issues = append(issues, issue("objective", "Choose a campaign objective."))
	}
	spec := request.Audience
	if len(spec.Locations) == 0 {
		issues = append(issues, issue("audience.locations", "Choose at least one location."))
	}
	if spec.AgeMin < 18 || spec.AgeMax > 65 || spec.AgeMin > spec.AgeMax {
		issues = append(issues, issue("audience.age", "Ages must be within 18-65."))
	}
	if !services.PlacementsAreSupported(request.Placements) {
		issues = append(issues, issue("placements", "Unknown placement."))
	}
	return fail(issues)
}
