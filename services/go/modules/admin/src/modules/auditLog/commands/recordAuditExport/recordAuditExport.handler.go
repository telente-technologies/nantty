package recordauditexport

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/repositories"
	jsonencoding "nantty/modules/admin/src/utils/jsonEncoding"
	"nantty/platform/identityports"
	"nantty/platform/staffauth"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, actor staffauth.Staff, rowCount int) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: actor.Id, ActorRole: actor.Role, Action: "audit.exported", SubjectType: "audit", SubjectId: "export",
			After: jsonencoding.MustMarshalJson(map[string]any{"rows": rowCount}),
		})
	})
}
