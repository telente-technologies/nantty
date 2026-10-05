package liststaff

import (
	"context"
	"strings"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/storemember"
	"zudomart/modules/catalog/src/modules/storeTeam/dtos"
	"zudomart/modules/catalog/src/modules/storeTeam/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.StaffMemberView], error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[dtos.StaffMemberView]{}, err
	}
	members, err := handler.Container.Client.StoreMember.Query().Where(storemember.StoreID(query.Store.StoreId)).Order(ent.Asc(storemember.FieldID)).Limit(500).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.StaffMemberView]{}, err
	}
	views, err := services.PresentStaffMembers(ctx, handler.Container, members)
	if err != nil {
		return httpserver.CursorPage[dtos.StaffMemberView]{}, err
	}
	text := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(query.Text), "@"))
	filtered := make([]dtos.StaffMemberView, 0, len(views))
	for _, view := range views {
		if after != nil && view.Id <= after.String() {
			continue
		}
		if text != "" && !strings.Contains(strings.ToLower(view.Name), text) && !strings.Contains(strings.ToLower(view.Username), text) {
			continue
		}
		filtered = append(filtered, view)
	}
	return utils.PageFromOverfetchedRows(filtered, query.Limit, func(view dtos.StaffMemberView) dtos.StaffMemberView { return view },
		func(view dtos.StaffMemberView) string { return utils.EncodeCursor(view.Id) }), nil
}
