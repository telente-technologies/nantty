package listliveincidents

import (
	"slices"
	"testing"
	"time"

	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/livesafetyincident"
)

func TestIncidentsSortUrgentAndHeldFirst(t *testing.T) {
	now := time.Now()
	normal := &ent.LiveSafetyIncident{LiveID: "normal", Status: livesafetyincident.StatusOpen, Priority: livesafetyincident.PriorityNormal, SLADueAt: now}
	urgent := &ent.LiveSafetyIncident{LiveID: "urgent", Status: livesafetyincident.StatusOpen, Priority: livesafetyincident.PriorityUrgent, SLADueAt: now.Add(time.Hour)}
	urgentHeld := &ent.LiveSafetyIncident{LiveID: "urgent-held", Status: livesafetyincident.StatusOpen, Priority: livesafetyincident.PriorityUrgent, HoldActive: true, SLADueAt: now.Add(2 * time.Hour)}
	closed := &ent.LiveSafetyIncident{LiveID: "closed", Status: livesafetyincident.StatusClosed, Priority: livesafetyincident.PriorityUrgent, SLADueAt: now.Add(-time.Hour)}
	rows := []*ent.LiveSafetyIncident{closed, normal, urgent, urgentHeld}
	slices.SortStableFunc(rows, CompareIncidentsUrgentFirst)
	var order []string
	for _, row := range rows {
		order = append(order, row.LiveID)
	}
	if !slices.Equal(order, []string{"urgent-held", "urgent", "normal", "closed"}) {
		t.Fatalf("unexpected order %v", order)
	}
}
