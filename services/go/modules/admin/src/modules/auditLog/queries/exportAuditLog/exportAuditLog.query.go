package exportauditlog

import "zudomart/modules/admin/src/modules/auditLog/models"

type Query struct {
	Filter models.AuditFilter
}
