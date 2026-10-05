package recordstaffconsent

import (
	"context"
	"strings"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/staffAccount/services"
	"zudomart/modules/admin/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	staff, err := services.LoadActiveStaff(ctx, handler.Container.Client, command.StaffId)
	if err != nil {
		return err
	}
	categories := map[string]bool{"essential": true}
	for category, granted := range command.Categories {
		if category != "essential" {
			categories[category] = granted
		}
	}
	client := types.ClientDetailsFromContext(ctx)
	return handler.Container.Client.StaffConsent.Create().SetStaffID(staff.ID).SetPolicyVersion(strings.TrimSpace(command.PolicyVersion)).
		SetCategories(categories).SetSource(command.Source).SetDecidedAt(command.DecidedAt.UTC()).
		SetIPAddress(types.TruncateToLength(client.IpAddress, 64)).SetUserAgent(types.TruncateToLength(client.UserAgent, 255)).Exec(ctx)
}
