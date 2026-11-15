package users_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	celebrationservices "nantty/modules/users/src/modules/celebrations/services"
	"nantty/platform/identityports"
	"nantty/platform/identityports/identitytest"
)

type celebrationDirectory struct {
	*identitytest.FakeAccountDirectory
	birthdays map[uuid.UUID]time.Time
	joined    map[uuid.UUID]time.Time
}

func (directory celebrationDirectory) FindAccountSummary(ctx context.Context, accountId uuid.UUID) (identityports.AccountSummary, bool, error) {
	summary, found, err := directory.FakeAccountDirectory.FindAccountSummary(ctx, accountId)
	if born, ok := directory.birthdays[accountId]; ok {
		summary.Birthday = &born
	}
	if joined, ok := directory.joined[accountId]; ok {
		summary.CreatedAt = joined
	}
	return summary, found, err
}

func TestBirthdayCelebrationIsSelfOnlyAgeOncePerDayAndRespectsPrivacy(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	adaId, adaToken := harness.newAccount("ada.birthday", "Ada")
	_, visitorToken := harness.newAccount("visitor.birthday", "Visitor")
	ada := mustParseUuid(adaId)
	directory := celebrationDirectory{FakeAccountDirectory: harness.accounts, birthdays: map[uuid.UUID]time.Time{ada: time.Date(2000, 10, 4, 0, 0, 0, 0, time.UTC)}, joined: map[uuid.UUID]time.Time{ada: time.Date(2024, 3, 3, 9, 0, 0, 0, time.UTC)}}
	identityports.Default.RegisterAccountDirectory(directory)
	harness.module.Container().Now = func() time.Time { return time.Date(2026, 10, 3, 23, 30, 0, 0, time.UTC) }

	harness.expect("PATCH", "/api/v1/users/me/celebrations/settings", adaToken, map[string]any{"timezone": "Africa/Lagos"}, http.StatusOK)
	mine := harness.expect("GET", "/api/v1/users/me/celebrations", adaToken, nil, http.StatusOK)
	birthday := mine["birthday"].(map[string]any)
	if birthday["today"] != true || birthday["age"].(float64) != 26 || mine["localDate"] != "2026-10-04" {
		t.Fatalf("lagos is already on Oct 4: %v", mine)
	}
	if shown := birthday["shown"].(map[string]any); shown["app"] != false {
		t.Fatalf("not shown yet: %v", shown)
	}
	harness.expect("POST", "/api/v1/users/me/celebrations/seen", adaToken, map[string]any{"kind": "birthday", "surface": "app"}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/users/me/celebrations/seen", adaToken, map[string]any{"kind": "birthday", "surface": "app"}, http.StatusNoContent)
	again := harness.expect("GET", "/api/v1/users/me/celebrations", adaToken, nil, http.StatusOK)
	if shown := again["birthday"].(map[string]any)["shown"].(map[string]any); shown["app"] != true || shown["profile"] != false {
		t.Fatalf("app surface remembered, profile not: %v", shown)
	}
	harness.expect("POST", "/api/v1/users/me/celebrations/seen", adaToken, map[string]any{"kind": "birthday", "surface": "email"}, http.StatusBadRequest)

	seenByVisitor := harness.expect("GET", "/api/v1/users/"+adaId, visitorToken, nil, http.StatusOK)
	if seenByVisitor["birthdayToday"] != true || seenByVisitor["birthday"] != nil {
		t.Fatalf("visitors see balloons but never the date: %v", seenByVisitor)
	}
	if _, leaked := seenByVisitor["age"]; leaked {
		t.Fatalf("age leaked: %v", seenByVisitor)
	}
	harness.expect("PATCH", "/api/v1/users/me/celebrations/settings", adaToken, map[string]any{"birthdayBalloonsVisible": false}, http.StatusOK)
	if hidden := harness.expect("GET", "/api/v1/users/"+adaId, visitorToken, nil, http.StatusOK); hidden["birthdayToday"] != false {
		t.Fatalf("opted out of balloons for others: %v", hidden)
	}
	if own := harness.expect("GET", "/api/v1/users/me", adaToken, nil, http.StatusOK); own["birthdayToday"] != true {
		t.Fatalf("self always sees their own celebration: %v", own)
	}
	harness.expect("PATCH", "/api/v1/users/me/celebrations/settings", adaToken, map[string]any{"timezone": "Not/AZone"}, http.StatusBadRequest)
}

func TestAnniversarySchedulerEmitsTheEmailEventOncePerYear(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("ada.anniversary", "Ada")
	account := mustParseUuid(accountId)
	identityports.Default.RegisterAccountDirectory(celebrationDirectory{FakeAccountDirectory: harness.accounts, joined: map[uuid.UUID]time.Time{account: time.Date(2024, 10, 3, 23, 30, 0, 0, time.UTC)}})
	harness.expect("GET", "/api/v1/users/me", token, nil, http.StatusOK)
	harness.expect("PATCH", "/api/v1/users/me/celebrations/settings", token, map[string]any{"timezone": "Africa/Lagos"}, http.StatusOK)
	container := harness.module.Container()
	container.Now = func() time.Time { return time.Date(2026, 10, 4, 8, 0, 0, 0, time.UTC) }
	scheduler := celebrationservices.AnniversaryScheduler{Container: container}
	for run := 0; run < 3; run++ {
		if err := scheduler.RunOnce(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	harness.waitForPublishedEvents("account.anniversaryReached")
	count := 0
	for _, eventType := range harness.publisher.PublishedEventTypes() {
		if eventType == "account.anniversaryReached" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("anniversary email event must be idempotent per local date, got %d", count)
	}
	view := harness.expect("GET", "/api/v1/users/me/celebrations", token, nil, http.StatusOK)
	if anniversary := view["anniversary"].(map[string]any); anniversary["today"] != true || anniversary["years"].(float64) != 2 {
		t.Fatalf("second nanttyversary: %v", anniversary)
	}
}
