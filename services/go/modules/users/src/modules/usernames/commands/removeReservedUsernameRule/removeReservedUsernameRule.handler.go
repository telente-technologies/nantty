package removereservedusernamerule

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	ruleId, err := uuid.Parse(command.Id)
	if err != nil {
		return httpserver.ErrNotFound
	}
	existing, err := handler.Container.Client.ReservedUsernameRule.Get(ctx, ruleId)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if err := handler.Container.Client.ReservedUsernameRule.DeleteOneID(ruleId).Exec(ctx); err != nil {
		return err
	}
	return services.RecordStaffAuditEvent(ctx, command.Actor, "users.reserved_username_removed", "reservedUsernameRule", command.Id, "", map[string]string{"term": existing.Term, "matchKind": string(existing.MatchKind)}, nil)
}
