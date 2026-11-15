package live_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

func (harness *liveHarness) scheduleAt(when time.Time) string {
	return when.UTC().Format(time.RFC3339)
}

func (harness *liveHarness) eventPayloads(eventType string) []map[string]any {
	harness.t.Helper()
	payloads := []map[string]any{}
	for _, published := range harness.publisher.PublishedEvents() {
		if published.EventType != eventType {
			continue
		}
		envelope := map[string]any{}
		if err := json.Unmarshal(published.Payload, &envelope); err != nil {
			harness.t.Fatal(err)
		}
		data, _ := envelope["data"].(map[string]any)
		payloads = append(payloads, data)
	}
	return payloads
}

func (harness *liveHarness) waitForEventCount(eventType string, want int) {
	harness.t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if len(harness.eventPayloads(eventType)) >= want {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	time.Sleep(200 * time.Millisecond)
	if got := len(harness.eventPayloads(eventType)); got != want {
		harness.t.Fatalf("want exactly %d %s events, got %d", want, eventType, got)
	}
}

func TestScheduledLiveCreateRejectsPastAndFarTimes(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	other := harness.newUser("other", "creator")
	now := harness.clock.Now()
	base := map[string]any{"title": "Pottery night", "category": "irl"}
	with := func(extra map[string]any) map[string]any {
		body := map[string]any{}
		for key, value := range base {
			body[key] = value
		}
		for key, value := range extra {
			body[key] = value
		}
		return body
	}
	for name, scheduledAt := range map[string]string{"past": harness.scheduleAt(now.Add(-time.Hour)), "now": harness.scheduleAt(now), "too far": harness.scheduleAt(now.Add(91 * 24 * time.Hour))} {
		status, body := harness.call("POST", "/api/v1/lives", &host, "", with(map[string]any{"scheduledAt": scheduledAt}))
		if status != http.StatusUnprocessableEntity || (body["code"] != "SCHEDULE_IN_PAST" && body["code"] != "SCHEDULE_TOO_FAR") {
			t.Fatalf("%s: expected 422 schedule error, got %d %v", name, status, body)
		}
	}
	if code := harness.expect("POST", "/api/v1/lives", &host, "", with(map[string]any{"scheduledAt": harness.scheduleAt(now.Add(2 * time.Hour)), "startNow": true}), http.StatusUnprocessableEntity)["code"]; code != "SCHEDULE_WITH_START_NOW" {
		t.Fatalf("scheduling and starting now together must be refused, got %v", code)
	}
	harness.expect("POST", "/api/v1/lives", &host, "", with(map[string]any{"scheduledAt": "tomorrow at 8"}), http.StatusBadRequest)

	scheduledAt := now.Add(2 * time.Hour).UTC().Truncate(time.Second)
	created := harness.expect("POST", "/api/v1/lives", &host, "", with(map[string]any{"scheduledAt": harness.scheduleAt(scheduledAt)}), http.StatusCreated)
	if created["state"] != "idle" || created["scheduledAt"] == nil {
		t.Fatalf("a scheduled live stays idle and carries its time: %v", created)
	}
	if parsed, _ := time.Parse(time.RFC3339, created["scheduledAt"].(string)); !parsed.Equal(scheduledAt) {
		t.Fatalf("scheduledAt round trip: %v want %v", created["scheduledAt"], scheduledAt)
	}
	harness.waitForEvent("live.scheduled")
	listed := harness.expect("GET", "/api/v1/lives", &host, "", nil, http.StatusOK)["data"].([]any)
	if len(listed) != 1 || listed[0].(map[string]any)["scheduledAt"] == nil {
		t.Fatalf("studio list must show the schedule: %v", listed)
	}
	if others := harness.expect("GET", "/api/v1/lives", &other, "", nil, http.StatusOK)["data"].([]any); len(others) != 0 {
		t.Fatalf("another creator must not see my lives: %v", others)
	}
}

func TestScheduledLivePatchAndCancelAreHostOnlyAndIdleOnly(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	other := harness.newUser("other", "creator")
	now := harness.clock.Now()
	liveId := harness.goLive(host, map[string]any{"scheduledAt": harness.scheduleAt(now.Add(3 * time.Hour))})
	path := "/api/v1/lives/" + liveId

	harness.expect("PATCH", path, &other, "", map[string]any{"title": "Hijacked"}, http.StatusForbidden)
	harness.expect("POST", path+"/cancel", &other, "", nil, http.StatusForbidden)
	harness.expect("PATCH", path, nil, "", map[string]any{"title": "Anon"}, http.StatusUnauthorized)
	if code := harness.expect("PATCH", path, &host, "", map[string]any{"scheduledAt": harness.scheduleAt(now.Add(-5 * time.Minute))}, http.StatusUnprocessableEntity)["code"]; code != "SCHEDULE_IN_PAST" {
		t.Fatalf("moving a live into the past must be refused, got %v", code)
	}
	harness.expect("PATCH", path, &host, "", map[string]any{"title": "   "}, http.StatusBadRequest)
	harness.expect("PATCH", path, &host, "", map[string]any{"category": "not-a-category"}, http.StatusBadRequest)

	later := now.Add(5 * time.Hour).UTC().Truncate(time.Second)
	updated := harness.expect("PATCH", path, &host, "", map[string]any{"title": "Pottery night, part two", "scheduledAt": harness.scheduleAt(later)}, http.StatusOK)
	if updated["title"] != "Pottery night, part two" {
		t.Fatalf("title not updated: %v", updated)
	}
	if parsed, _ := time.Parse(time.RFC3339, updated["scheduledAt"].(string)); !parsed.Equal(later) {
		t.Fatalf("schedule not moved: %v", updated)
	}
	unscheduled := harness.expect("PATCH", path, &host, "", map[string]any{"scheduledAt": nil}, http.StatusOK)
	if unscheduled["scheduledAt"] != nil {
		t.Fatalf("null clears the schedule: %v", unscheduled)
	}
	harness.waitForEvent("live.scheduleCancelled")
	harness.expect("PATCH", path, &host, "", map[string]any{"scheduledAt": harness.scheduleAt(later)}, http.StatusOK)

	harness.expect("POST", path+"/cancel", &host, "", nil, http.StatusNoContent)
	if code := harness.expect("POST", path+"/cancel", &host, "", nil, http.StatusConflict)["code"]; code != "LIVE_NOT_EDITABLE" {
		t.Fatalf("cancelling twice must conflict, got %v", code)
	}
	harness.expect("PATCH", path, &host, "", map[string]any{"title": "Too late"}, http.StatusConflict)
	harness.waitForEventCount("live.scheduleCancelled", 2)

	running := harness.goLive(host, nil)
	harness.expect("PATCH", "/api/v1/lives/"+running, &host, "", map[string]any{"title": "Mid-stream"}, http.StatusConflict)
	harness.expect("POST", "/api/v1/lives/"+running+"/cancel", &host, "", nil, http.StatusConflict)
}

func TestReminderIsSentOnceToFollowersBeforeTheStart(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	follower := harness.newUser("follower", "buyer")
	harness.relations.Follow(follower.id, host.id)
	now := harness.clock.Now()
	liveId := harness.goLive(host, map[string]any{"scheduledAt": harness.scheduleAt(now.Add(time.Hour))})
	time.Sleep(300 * time.Millisecond)
	if reminders := harness.eventPayloads("live.reminderDue"); len(reminders) != 0 {
		t.Fatalf("no reminder an hour ahead: %v", reminders)
	}
	harness.clock.Advance(50 * time.Minute)
	harness.waitForEventCount("live.reminderDue", 1)
	harness.clock.Advance(time.Minute)
	harness.waitForEventCount("live.reminderDue", 1)
	reminder := harness.eventPayloads("live.reminderDue")[0]
	recipients, _ := reminder["notifyUserIds"].([]any)
	if reminder["liveId"] != liveId || reminder["hostId"] != host.id.String() || len(recipients) != 1 || recipients[0] != follower.id.String() {
		t.Fatalf("reminder must target the follower: %v", reminder)
	}
}
