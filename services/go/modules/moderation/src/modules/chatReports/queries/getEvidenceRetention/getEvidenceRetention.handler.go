package getevidenceretention

import (
	"context"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/chatReports/services"
)

type Result struct {
	RetentionDays int    `json:"retentionDays"`
	LegalHoldDays int    `json:"legalHoldDays"`
	Label         string `json:"label"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context) (Result, error) {
	retention, legalHold, err := services.LoadRetentionSettings(ctx, handler.Container.Client)
	return Result{RetentionDays: retention, LegalHoldDays: legalHold, Label: "LEGAL REVIEW"}, err
}
