package controllers

import (
	"encoding/json"
	"net/http"
	"time"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	recordauditexport "zudomart/modules/admin/src/modules/auditLog/commands/recordAuditExport"
	"zudomart/modules/admin/src/modules/auditLog/models"
	exportauditlog "zudomart/modules/admin/src/modules/auditLog/queries/exportAuditLog"
	getauditentry "zudomart/modules/admin/src/modules/auditLog/queries/getAuditEntry"
	getauditfacets "zudomart/modules/admin/src/modules/auditLog/queries/getAuditFacets"
	searchauditlog "zudomart/modules/admin/src/modules/auditLog/queries/searchAuditLog"
	httprequests "zudomart/modules/admin/src/utils/httpRequests"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type AuditLogController struct {
	Container *container.Container
}

func readFilter(request *http.Request) (models.AuditFilter, error) {
	query := request.URL.Query()
	filter := models.AuditFilter{
		Cursor: query.Get("cursor"), Action: query.Get("action"), ActorId: query.Get("actorId"), SubjectType: firstNonEmpty(query.Get("targetType"), query.Get("subjectType")),
		SubjectId: firstNonEmpty(query.Get("targetId"), query.Get("subjectId")), Area: query.Get("area"), Search: query.Get("search"),
	}
	for name, destination := range map[string]**time.Time{"from": &filter.From, "to": &filter.To} {
		if raw := query.Get(name); raw != "" {
			parsed, err := time.Parse(time.RFC3339, raw)
			if err != nil {
				return filter, adminerrors.Unprocessable(name + " must be an RFC 3339 timestamp.")
			}
			*destination = &parsed
		}
	}
	return filter, nil
}

func (controller AuditLogController) Search(writer http.ResponseWriter, request *http.Request) {
	filter, err := readFilter(request)
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	result, err := searchauditlog.Handler{Container: controller.Container}.Execute(request.Context(), searchauditlog.Query{Filter: filter})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller AuditLogController) Export(writer http.ResponseWriter, request *http.Request) {
	filter, err := readFilter(request)
	var rows []models.AuditEventView
	if err == nil {
		rows, err = exportauditlog.Handler{Container: controller.Container}.Execute(request.Context(), exportauditlog.Query{Filter: filter})
	}
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	actor, _ := staffauth.StaffFromContext(request.Context())
	if err := (recordauditexport.Handler{Container: controller.Container}).Execute(request.Context(), actor, len(rows)); err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	if request.URL.Query().Get("format") == "csv" {
		writeCsv(writer, rows)
		return
	}
	writer.Header().Set("Content-Type", "application/x-ndjson")
	writer.Header().Set("Content-Disposition", `attachment; filename="audit-log.ndjson"`)
	encoder := json.NewEncoder(writer)
	for _, row := range rows {
		if err := encoder.Encode(row); err != nil {
			return
		}
	}
}

func (controller AuditLogController) Get(writer http.ResponseWriter, request *http.Request) {
	view, err := getauditentry.Handler{Container: controller.Container}.Execute(request.Context(), getauditentry.Query{Id: request.PathValue("entryId")})
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller AuditLogController) Facets(writer http.ResponseWriter, request *http.Request) {
	result, err := getauditfacets.Handler{Container: controller.Container}.Execute(request.Context())
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
