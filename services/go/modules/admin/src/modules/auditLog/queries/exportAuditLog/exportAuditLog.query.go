package exportauditlog

import "nantty/modules/admin/src/modules/auditLog/models"

type Query struct {
	Filter models.AuditFilter
}
