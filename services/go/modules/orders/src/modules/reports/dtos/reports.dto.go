package dtos

import "time"

type ExportRequest struct {
	Kind string `json:"kind"`
	From string `json:"from"`
	To   string `json:"to"`
}

type ExportView struct {
	Id          string     `json:"id"`
	Kind        string     `json:"kind"`
	From        string     `json:"from"`
	To          string     `json:"to"`
	Status      string     `json:"status"`
	RowCount    int        `json:"rowCount"`
	Error       *string    `json:"error"`
	CreatedAt   time.Time  `json:"createdAt"`
	CompletedAt *time.Time `json:"completedAt"`
}
