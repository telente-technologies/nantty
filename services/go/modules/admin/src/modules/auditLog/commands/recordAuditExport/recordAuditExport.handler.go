package recordauditexport

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/repositories"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
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
