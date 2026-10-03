package services

import (
	"time"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/modules/reporting/dtos"
)

func PresentScheduledReport(row *ent.AdScheduledReport) dtos.ScheduledReport {
	return dtos.ScheduledReport{
		Id: row.ID.String(), Name: row.Name, Recipients: row.Recipients, Frequency: string(row.Frequency), Breakdown: row.Breakdown, Metrics: row.Metrics,
		NextSendAt: row.NextSendAt.UTC().Format(time.RFC3339), CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
	}
}
