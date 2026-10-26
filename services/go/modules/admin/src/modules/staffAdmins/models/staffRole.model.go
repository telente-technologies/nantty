package models

import "nantty/modules/admin/src/generated/ent"

type StaffRoleView struct {
	Id          string   `json:"id"`
	Name        string   `json:"name"`
	Department  string   `json:"department"`
	Permissions []string `json:"permissions"`
	IsTemplate  bool     `json:"isTemplate"`
}

func ConvertRoleToView(row *ent.StaffRole) StaffRoleView {
	if row == nil {
		return StaffRoleView{}
	}
	permissions := row.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	return StaffRoleView{Id: row.ID.String(), Name: row.Name, Department: row.Department, Permissions: permissions, IsTemplate: row.IsTemplate}
}
