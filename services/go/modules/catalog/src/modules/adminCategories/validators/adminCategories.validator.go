package validators

import (
	"regexp"
	"strings"

	"nantty/modules/catalog/src/modules/adminCategories/dtos"
	"nantty/modules/catalog/src/utils"
)

var (
	slugPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	iconPattern = regexp.MustCompile(`^[a-z][a-zA-Z0-9]{0,39}$`)
)

func CheckReason(reason string, issues *utils.Issues) {
	issues.CheckLength("reason", reason, 5, 1000)
}

func checkFields(name, slug, icon *string, issues *utils.Issues) {
	if name != nil {
		issues.CheckLength("name", *name, 2, 60)
	}
	if slug != nil && (len(*slug) > 60 || !slugPattern.MatchString(*slug)) {
		issues.Add("slug", "Use lowercase letters, numbers and single hyphens.")
	}
	if icon != nil && *icon != "" && !iconPattern.MatchString(*icon) {
		issues.Add("iconName", "Icon names are camelCase letters and numbers.")
	}
}

func ValidateCreateCategory(request dtos.CreateCategoryRequest) error {
	issues := utils.Issues{}
	checkFields(&request.Name, request.Slug, request.IconName, &issues)
	if request.ParentId != nil {
		utils.ParseIdentifier("parentId", *request.ParentId, &issues)
	}
	CheckReason(request.Reason, &issues)
	return issues.AsError()
}

func ValidateUpdateCategory(request dtos.UpdateCategoryRequest) error {
	issues := utils.Issues{}
	checkFields(request.Name, request.Slug, request.IconName.Value, &issues)
	if request.ParentId.Value != nil {
		utils.ParseIdentifier("parentId", *request.ParentId.Value, &issues)
	}
	CheckReason(request.Reason, &issues)
	return issues.AsError()
}

func ValidateMove(request dtos.MoveRequest) error {
	if request.Direction != "up" && request.Direction != "down" {
		issues := utils.Issues{}
		issues.Add("direction", "must be up or down")
		return issues.AsError()
	}
	return nil
}

func ValidateReason(request dtos.ReasonRequest) error {
	issues := utils.Issues{}
	CheckReason(request.Reason, &issues)
	return issues.AsError()
}

func Trimmed(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
