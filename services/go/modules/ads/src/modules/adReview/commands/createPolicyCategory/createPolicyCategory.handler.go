package createpolicycategory

import (
	"context"
	"regexp"
	"strings"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adpolicycategory"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

var nonCodeCharacters = regexp.MustCompile(`[^a-z0-9]+`)

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PolicyCategory, error) {
	if err := ValidateFields(command.Request); err != nil {
		return dtos.PolicyCategory{}, err
	}
	name := strings.TrimSpace(command.Request.Name)
	code := strings.Trim(nonCodeCharacters.ReplaceAllString(strings.ToLower(name), "_"), "_")
	exists, err := handler.Container.Client.AdPolicyCategory.Query().Where(adpolicycategory.Or(adpolicycategory.Code(code), adpolicycategory.Name(name))).Exist(ctx)
	if err != nil {
		return dtos.PolicyCategory{}, err
	}
	if exists {
		return dtos.PolicyCategory{}, adserrors.PolicyExists
	}
	created, err := handler.Container.Client.AdPolicyCategory.Create().SetCode(code).SetName(name).SetDescription(strings.TrimSpace(command.Request.Description)).SetSeverity(adpolicycategory.Severity(command.Request.Severity)).Save(ctx)
	if ent.IsConstraintError(err) {
		return dtos.PolicyCategory{}, adserrors.PolicyExists
	}
	if err != nil {
		return dtos.PolicyCategory{}, err
	}
	return services.PresentPolicyCategory(created), nil
}
