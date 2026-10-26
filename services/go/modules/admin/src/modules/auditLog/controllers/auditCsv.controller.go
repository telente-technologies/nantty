package controllers

import (
	"encoding/csv"
	"net/http"
	"strings"

	"nantty/modules/admin/src/modules/auditLog/models"
)

var auditCsvColumns = []string{"id", "occurredAt", "staffId", "actorName", "role", "departments", "action", "area", "targetType", "targetId", "targetLabel", "reason", "ipAddress", "requestId", "stepUpVerified"}

func neutralizeSpreadsheetFormula(cell string) string {
	if cell != "" && strings.ContainsRune("=+-@\t\r", rune(cell[0])) {
		return "'" + cell
	}
	return cell
}

func writeCsv(writer http.ResponseWriter, rows []models.AuditEventView) {
	writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
	writer.Header().Set("Content-Disposition", `attachment; filename="audit-log.csv"`)
	output := csv.NewWriter(writer)
	_ = output.Write(auditCsvColumns)
	for _, row := range rows {
		stepUp := "false"
		if row.StepUpVerified {
			stepUp = "true"
		}
		cells := []string{row.Id, row.OccurredAt, row.Actor.Id, row.Actor.Name, row.Actor.Role, strings.Join(row.Actor.Departments, "; "), row.Action, row.Area,
			row.Target.Type, row.Target.Id, row.Target.Label, row.Reason, row.IpAddress, row.RequestId, stepUp}
		for index := range cells {
			cells[index] = neutralizeSpreadsheetFormula(cells[index])
		}
		_ = output.Write(cells)
	}
	output.Flush()
}
