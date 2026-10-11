package moderation

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestStaffCannotDecideAContentReportTheyFiledOrOneAboutTheirOwnContent(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	access, _, staffId := harness.tokens.SignStaffTokensForTest(harness.t, "admin", []string{"moderation:reports"})
	decide := func(targetType, targetId, reporter string) map[string]any {
		if err := harness.contentReportHandler()(context.Background(), reportCreatedEnvelope(reporter, targetType, targetId, "spam", "")); err != nil {
			t.Fatal(err)
		}
		queue := harness.expect("GET", "/api/v1/admin/reports?search="+targetId, access, nil, http.StatusOK)["data"].([]any)
		reportId := queue[0].(map[string]any)["id"].(string)
		return harness.expect("POST", "/api/v1/admin/reports/"+reportId+"/actions", access, map[string]string{"action": "HIDE", "reason": "breaks the spam policy"}, http.StatusConflict)
	}
	harness.targets.own("post", "p-filed-by-staff", uuid.NewString())
	if filed := decide("post", "p-filed-by-staff", staffId); filed["code"] != "OWN_REPORT" {
		t.Fatalf("deciding a report you filed: %v", filed)
	}
	harness.targets.own("post", "p-staff-authored", staffId)
	if authored := decide("post", "p-staff-authored", uuid.NewString()); authored["code"] != "OWN_REPORT" {
		t.Fatalf("deciding a report about your own content: %v", authored)
	}
}

func TestStaffCannotDecideAChatReportTheyFiled(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	access, _, staffId := harness.tokens.SignStaffTokensForTest(harness.t, "admin", []string{"chat-reports:review"})
	reporterToken := harness.tokens.SignAccountAccessToken(t, staffId)
	reportId := harness.submit(reporterToken, nil, http.StatusCreated)["id"].(string)
	refused := harness.expect("POST", "/api/v1/admin/chat-reports/"+reportId+"/actions", access, map[string]string{"action": "DISMISS", "reason": "nothing to see here"}, http.StatusConflict)
	if refused["code"] != "OWN_REPORT" {
		t.Fatalf("deciding your own chat report: %v", refused)
	}
	other, _ := harness.staff("chat-reports:review")
	harness.expect("POST", "/api/v1/admin/chat-reports/"+reportId+"/actions", other, map[string]string{"action": "DISMISS", "reason": "nothing to see here"}, http.StatusOK)
}
