package getstaffdetail

import (
	"nantty/modules/admin/src/modules/auditLog/models"
	"nantty/modules/admin/src/types"
)

type Query struct {
	TargetId string
}

type Result struct {
	Admin              types.StaffView         `json:"admin"`
	ActiveSessionCount int                     `json:"activeSessionCount"`
	History            []models.AuditEventView `json:"history"`
	LastActions        []models.AuditEventView `json:"lastActions"`
}
