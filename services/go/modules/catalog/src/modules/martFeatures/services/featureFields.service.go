package services

import (
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/configs"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/modules/martFeatures/dtos"
	"nantty/modules/catalog/src/utils"
)

var (
	FeatureKinds      = []string{"HERO_BANNER", "PROMO_BANNER", "FEATURED_COLLECTION", "FEATURED_STORE"}
	TargetTypes       = []string{"CATEGORY", "COLLECTION", "STORE", "PRODUCT", "URL"}
	Collections       = []string{"sales_of_the_day", "featured_brands", "new_arrivals"}
	zudomartUrlFormat = regexp.MustCompile(`^https://([a-z0-9-]+\.)*zudomart\.com(/|$)`)
)

type FeatureFields struct {
	Title       string     `json:"title"`
	Subtitle    *string    `json:"subtitle"`
	Kind        string     `json:"kind"`
	ImageId     string     `json:"imageId"`
	TargetType  string     `json:"targetType"`
	TargetValue string     `json:"targetValue"`
	Countries   []string   `json:"countries"`
	StartsAt    time.Time  `json:"startsAt"`
	EndsAt      *time.Time `json:"endsAt"`
}

func FieldsOf(row *ent.MartFeature) FeatureFields {
	return FeatureFields{Title: row.Title, Subtitle: row.Subtitle, Kind: row.Kind, ImageId: row.ImageID, TargetType: row.TargetType, TargetValue: row.TargetValue,
		Countries: row.Countries, StartsAt: row.StartsAt, EndsAt: row.EndsAt}
}

func ResolveFields(settings configs.CatalogSettings, request dtos.FeatureRequest, existing *FeatureFields) (FeatureFields, error) {
	fields := FeatureFields{}
	if existing != nil {
		fields = *existing
	}
	issues := utils.Issues{}
	pick := func(value *string, target *string, path string) {
		if value != nil {
			*target = strings.TrimSpace(*value)
		} else if existing == nil {
			issues.Add(path, "is required")
		}
	}
	pick(request.Title, &fields.Title, "title")
	pick(request.Kind, &fields.Kind, "kind")
	pick(request.ImageId, &fields.ImageId, "imageId")
	pick(request.TargetType, &fields.TargetType, "targetType")
	pick(request.TargetValue, &fields.TargetValue, "targetValue")
	if request.Subtitle.Present {
		fields.Subtitle = trimmedOrNil(request.Subtitle.Value)
	}
	if request.Countries != nil || existing == nil {
		fields.Countries = uniqueCountries(request.Countries)
	}
	if request.StartsAt != nil {
		fields.StartsAt = request.StartsAt.UTC()
	} else if existing == nil {
		issues.Add("startsAt", "is required")
	}
	if request.EndsAt.Present {
		fields.EndsAt = nil
		if text := trimmedOrNil(request.EndsAt.Value); text != nil {
			parsed, err := time.Parse(time.RFC3339, *text)
			if err != nil {
				issues.Add("endsAt", "endsAt must be a date and time.")
			} else {
				parsed = parsed.UTC()
				fields.EndsAt = &parsed
			}
		}
	}
	checkFields(settings, fields, &issues)
	return fields, issues.AsError()
}

func checkFields(settings configs.CatalogSettings, fields FeatureFields, issues *utils.Issues) {
	issues.CheckLength("title", fields.Title, 3, 60)
	if fields.Subtitle != nil && len(*fields.Subtitle) > 90 {
		issues.Add("subtitle", "must be at most 90 characters")
	}
	if !slices.Contains(FeatureKinds, fields.Kind) {
		issues.Add("kind", "must be one of "+strings.Join(FeatureKinds, ", "))
	}
	if _, known := ImageUrlOf(settings, fields.ImageId); !known {
		issues.Add("imageId", "Choose an image from the approved library.")
	}
	switch fields.TargetType {
	case "URL":
		if !zudomartUrlFormat.MatchString(fields.TargetValue) || len(fields.TargetValue) > 200 {
			issues.Add("targetValue", "Links must be https:// addresses on zudomart.com.")
		}
	case "COLLECTION":
		if !slices.Contains(Collections, fields.TargetValue) {
			issues.Add("targetValue", "must be one of "+strings.Join(Collections, ", "))
		}
	case "CATEGORY", "STORE", "PRODUCT":
		if _, err := uuid.Parse(fields.TargetValue); err != nil {
			issues.Add("targetValue", "must be a valid id")
		}
	default:
		issues.Add("targetType", "must be one of "+strings.Join(TargetTypes, ", "))
	}
	if len(fields.Countries) == 0 {
		issues.Add("countries", "Choose at least one supported country.")
	}
	for _, country := range fields.Countries {
		if !slices.Contains(settings.MartCountries, country) {
			issues.Add("countries", "Choose at least one supported country.")
			break
		}
	}
	if fields.EndsAt != nil && !fields.EndsAt.After(fields.StartsAt) {
		issues.Add("endsAt", "The end must be after the start.")
	}
}

func uniqueCountries(values []string) []string {
	unique := []string{}
	for _, value := range values {
		code := strings.ToUpper(strings.TrimSpace(value))
		if code != "" && !slices.Contains(unique, code) {
			unique = append(unique, code)
		}
	}
	return unique
}

func trimmedOrNil(value *string) *string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}
