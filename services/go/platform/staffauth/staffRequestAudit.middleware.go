package staffauth

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"

	"nantty/platform/httpserver"
	"nantty/platform/identityports"
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
		if status != http.StatusNoContent && status != http.StatusNotModified {
			httpserver.EnsureSafeResponseContentType(writer.ResponseWriter)
		}
		writer.status = status
	}
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *statusCapturingWriter) Write(chunk []byte) (int, error) {
	httpserver.EnsureSafeResponseContentType(writer.ResponseWriter)
	if writer.status == 0 {
		writer.status = http.StatusOK
	}
	return writer.ResponseWriter.Write(chunk)
}

func (writer *statusCapturingWriter) Unwrap() http.ResponseWriter { return writer.ResponseWriter }

const maximumAuditedBodyBytes = 64 * 1024

func readReasonAndRestoreBody(request *http.Request) string {
	if request.Body == nil || !strings.Contains(request.Header.Get("Content-Type"), "json") || request.ContentLength > maximumAuditedBodyBytes {
		return ""
	}
	body, err := io.ReadAll(io.LimitReader(request.Body, maximumAuditedBodyBytes+1))
	request.Body = io.NopCloser(io.MultiReader(bytes.NewReader(body), request.Body))
	if err != nil || len(body) > maximumAuditedBodyBytes {
		return ""
	}
	var payload struct {
		Reason string `json:"reason"`
	}
	if json.Unmarshal(body, &payload) != nil {
		return ""
	}
	reason := strings.TrimSpace(payload.Reason)
	if len(reason) > 1000 {
		reason = reason[:1000]
	}
	return reason
}

func isMutatingMethod(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

func (guard Guard) serveAndAuditUnrecordedMutation(writer http.ResponseWriter, request *http.Request, staff Staff, next http.Handler) {
	ctx := ContextWithStaff(request.Context(), staff)
	if !isMutatingMethod(request.Method) {
		next.ServeHTTP(writer, request.WithContext(ctx))
		return
	}
	reason := readReasonAndRestoreBody(request)
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
	route := request.Method + " " + request.URL.Path
	recorder, err := guard.Registry.AuditRecorder()
	if err != nil {
		slog.Default().ErrorContext(ctx, "catch-all staff audit skipped: no audit recorder registered", "route", route, "error", err)
		return
	}
	after, _ := json.Marshal(map[string]int{"status": status})
	event := identityports.AuditEvent{
		ActorId: staff.Id, ActorName: staff.Name, ActorRole: staff.Role, Action: "admin.request", SubjectType: "admin_route", SubjectId: route, SubjectLabel: route,
		StepUpVerified: staff.SteppedUp, After: after, Reason: reason, IpAddress: ClientAddress(request), UserAgent: request.UserAgent(), RequestId: httpserver.RequestIdFromContext(request.Context()),
	}
	if err := recorder.RecordAuditEvent(context.WithoutCancel(ctx), event); err != nil {
		slog.Default().WarnContext(ctx, "catch-all staff audit failed", "route", route, "error", err)
	}
}
