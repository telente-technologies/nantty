package renameaudience

import (
	"context"
	"strings"

	"nantty/modules/ads/src/container"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/modules/audiences/services"
	"nantty/modules/ads/src/modules/audiences/validators"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CustomAudience, error) {
	deployed := handler.Container
	if err := validators.ValidateRename(command.Request); err != nil {
		return dtos.CustomAudience{}, err
	}
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionAudiencesManage); err != nil {
		return dtos.CustomAudience{}, err
	}
	row, err := services.LoadAudienceInAccount(ctx, deployed.Client, command.AccountId, command.AudienceId)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	row, err = row.Update().SetName(strings.TrimSpace(command.Request.Name)).Save(ctx)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	return services.PresentAudience(row, services.CountAdSetsUsing(ctx, deployed, command.AccountId, row.ID)), nil
}
