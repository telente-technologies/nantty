package searchauditlog

import "zudomart/modules/admin/src/modules/auditLog/models"

type Query struct {
	Filter models.AuditFilter
}

type Result struct {
	Data       []models.AuditEventView `json:"data"`
	NextCursor *string                 `json:"nextCursor"`
}
