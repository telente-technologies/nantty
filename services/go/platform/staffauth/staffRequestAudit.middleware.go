package staffauth

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync/atomic"

	"zudomart/platform/identityports"
)

type requestAuditTrace struct {
	recorded atomic.Int32
}

type requestAuditTraceKey struct{}

func MarkAuditRecorded(ctx context.Context) {
	if trace, found := ctx.Value(requestAuditTraceKey{}).(*requestAuditTrace); found {
		trace.recorded.Add(1)
	}
}

type statusCapturingWriter struct {
	http.ResponseWriter
	status int
}

func (writer *statusCapturingWriter) WriteHeader(status int) {
	if writer.status == 0 {
		writer.status = status
	}
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *statusCapturingWriter) Write(chunk []byte) (int, error) {
	if writer.status == 0 {
		writer.status = http.StatusOK
	}
	return writer.ResponseWriter.Write(chunk)
}

func (writer *statusCapturingWriter) Unwrap() http.ResponseWriter { return writer.ResponseWriter }

func isMutatingMethod(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

func (guard Guard) serveAndAuditUnrecordedMutation(writer http.ResponseWriter, request *http.Request, staff Staff, next http.Handler) {
	ctx := ContextWithStaff(request.Context(), staff)
	if !isMutatingMethod(request.Method) {
		next.ServeHTTP(writer, request.WithContext(ctx))
		return
	}
	trace := &requestAuditTrace{}
	ctx = context.WithValue(ctx, requestAuditTraceKey{}, trace)
	captured := &statusCapturingWriter{ResponseWriter: writer}
	next.ServeHTTP(captured, request.WithContext(ctx))
	status := captured.status
	if status == 0 {
		status = http.StatusOK
	}
	if status >= http.StatusBadRequest || trace.recorded.Load() > 0 {
		return
	}
	recorder, err := guard.Registry.AuditRecorder()
	if err != nil {
		return
	}
	route := request.Method + " " + request.URL.Path
	after, _ := json.Marshal(map[string]int{"status": status})
	event := identityports.AuditEvent{
		ActorId: staff.Id, ActorName: staff.Name, ActorRole: staff.Role, Action: "admin.request", SubjectType: "admin_route", SubjectId: route, SubjectLabel: route,
		StepUpVerified: staff.SteppedUp, After: after, IpAddress: ClientAddress(request), UserAgent: request.UserAgent(), RequestId: request.Header.Get("X-Request-Id"),
	}
	if err := recorder.RecordAuditEvent(context.WithoutCancel(ctx), event); err != nil {
		slog.Default().WarnContext(ctx, "catch-all staff audit failed", "route", route, "error", err)
	}
}
