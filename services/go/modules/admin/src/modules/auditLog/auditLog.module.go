package auditlog

import (
	"context"
	"net/http"

	"nantty/modules/admin/src/container"
	recordauditevent "nantty/modules/admin/src/modules/auditLog/commands/recordAuditEvent"
	"nantty/modules/admin/src/modules/auditLog/routes"
	"nantty/platform/identityports"
)

type AuditRecorder struct {
	Container *container.Container
}

func (recorder AuditRecorder) RecordAuditEvent(ctx context.Context, event identityports.AuditEvent) error {
	return recordauditevent.Handler{Container: recorder.Container}.Execute(ctx, recordauditevent.Command{Event: event})
}

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountAuditLogRoutes(mux, container)
}
