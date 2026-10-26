package updatepolicycategory

import (
	"context"
	"strings"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adpolicycategory"
	createpolicycategory "nantty/modules/ads/src/modules/adReview/commands/createPolicyCategory"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PolicyCategory, error) {
	if err := createpolicycategory.ValidateFields(command.Request); err != nil {
		return dtos.PolicyCategory{}, err
	}
	if len(strings.TrimSpace(command.Request.Reason)) < 5 || command.Request.IsActive == nil {
		return dtos.PolicyCategory{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "State a reason and the active flag."}})
	}
	updated, err := handler.Container.Client.AdPolicyCategory.UpdateOneID(command.CategoryId).SetName(strings.TrimSpace(command.Request.Name)).SetDescription(strings.TrimSpace(command.Request.Description)).
		SetSeverity(adpolicycategory.Severity(command.Request.Severity)).SetIsActive(*command.Request.IsActive).Save(ctx)
	if ent.IsNotFound(err) {
		return dtos.PolicyCategory{}, adserrors.NotFound
	}
	if ent.IsConstraintError(err) {
		return dtos.PolicyCategory{}, adserrors.PolicyExists
	}
	if err != nil {
		return dtos.PolicyCategory{}, err
	}
	return services.PresentPolicyCategory(updated), nil
}
