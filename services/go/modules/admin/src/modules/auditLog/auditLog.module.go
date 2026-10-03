package auditlog

import (
	"context"
	"net/http"

	"zudomart/modules/admin/src/container"
	recordauditevent "zudomart/modules/admin/src/modules/auditLog/commands/recordAuditEvent"
	"zudomart/modules/admin/src/modules/auditLog/routes"
	"zudomart/platform/identityports"
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
