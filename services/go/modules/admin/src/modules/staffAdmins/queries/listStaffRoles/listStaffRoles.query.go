package liststaffroles

import "zudomart/modules/admin/src/modules/staffAdmins/models"

type Query struct{}

type Result struct {
	Items      []models.StaffRoleView `json:"items"`
	Data       []models.StaffRoleView `json:"data"`
	NextCursor *string                `json:"nextCursor"`
}
