package moderation

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	automationrules "nantty/modules/moderation/src/modules/automationRules"
)

func automationRuleContent(name string, overrides map[string]any) map[string]any {
	content := map[string]any{
		"name": name, "description": "Hide scam reports until reviewed", "isEnabled": true, "event": "report.created", "conditionMatch": "ALL",
		"conditions": []any{map[string]any{"field": "reason", "operator": "IN", "value": "scam, counterfeit"}},
		"actions":    []any{map[string]any{"type": "hide_target", "parameters": map[string]any{"priority": "80"}}},
	}
	for key, value := range overrides {
		content[key] = value
	}
	return content
}

func messageSentEnvelope(sender string, recipients int) []byte {
	ids := []string{}
	for range recipients {
		ids = append(ids, uuid.NewString())
	}
	data, _ := json.Marshal(map[string]any{"conversationId": uuid.NewString(), "messageId": uuid.NewString(), "senderId": sender, "kind": "text", "recipientIds": ids, "isNewConversation": true})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "message.sent", "source": "social", "subject": "c", "schemaVersion": 1, "occurredAt": time.Now().UTC().Format(time.RFC3339), "data": json.RawMessage(data)})
	return envelope
}

func TestAutomationRulesAreVersionedRecordsBehindStepUp(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	manager, stepUp := harness.staff("automation:manage")
	nobody, nobodyStepUp := harness.staff("moderation:reports")
	base := "/api/v1/admin/automation/rules/rule_hide_scams"
	body := map[string]any{"expectedVersion": 0, "reason": "Brigading protection", "content": automationRuleContent("Hide scams", nil)}
	harness.expect("GET", "/api/v1/admin/automation/catalog", nobody, nil, http.StatusForbidden)
	harness.expect("PUT", base, nobody, body, http.StatusForbidden, nobodyStepUp...)
	harness.expect("PUT", base, manager, body, http.StatusForbidden)
	harness.expect("PUT", "/api/v1/admin/automation/rules/Bad-Id", manager, body, http.StatusBadRequest, stepUp...)
	harness.expect("PUT", base, manager, map[string]any{"expectedVersion": 0, "reason": "ok reason", "content": automationRuleContent("Hide scams", map[string]any{"event": "payout.requested"})}, http.StatusBadRequest, stepUp...)
	created := harness.expect("PUT", base, manager, body, http.StatusCreated, stepUp...)
	content := created["content"].(map[string]any)
	if created["version"] != float64(1) || created["isArchived"] != false || content["maxExecutionsPerHour"] != float64(60) || content["cooldownSeconds"] != nil {
		t.Fatalf("unexpected record %v", created)
	}
	conflict := harness.expect("PUT", base, manager, body, http.StatusConflict, stepUp...)
	if conflict["code"] != "VERSION_CONFLICT" {
		t.Fatalf("stale writes conflict: %v", conflict)
	}
	update := automationRuleContent("Hide scams fast", map[string]any{"cooldownSeconds": 3600})
	harness.expect("PUT", base, manager, map[string]any{"expectedVersion": 1, "reason": "Rename and add cooldown", "content": update}, http.StatusOK, stepUp...)
	listed := harness.expect("GET", "/api/v1/admin/automation/rules", manager, nil, http.StatusOK)["items"].([]any)
	if len(listed) != 1 || listed[0].(map[string]any)["version"] != float64(2) {
		t.Fatalf("one current record: %v", listed)
	}
	restored := harness.expect("POST", base+"/versions/1/restore", manager, map[string]any{"expectedVersion": 2, "reason": "Back to the original"}, http.StatusOK, stepUp...)
	if restored["version"] != float64(3) || restored["content"].(map[string]any)["name"] != "Hide scams" {
		t.Fatalf("restore appends a new version: %v", restored)
	}
	archived := harness.expect("DELETE", base, manager, map[string]any{"expectedVersion": 3, "reason": "Not needed any more"}, http.StatusOK, stepUp...)
	if archived["isArchived"] != true {
		t.Fatalf("unexpected archive %v", archived)
	}
	harness.expect("GET", base, manager, nil, http.StatusNotFound)
	if versions := harness.expect("GET", base+"/versions", manager, nil, http.StatusOK)["items"].([]any); len(versions) != 4 || versions[0].(map[string]any)["version"] != float64(4) {
		t.Fatalf("history is newest first and keeps the archive: %v", versions)
	}
	harness.expect("PUT", base, manager, body, http.StatusCreated, stepUp...)
	for _, action := range []string{"config.automation_rule.created", "config.automation_rule.updated", "config.automation_rule.restored", "config.automation_rule.archived"} {
		if !harness.audit.has(action) {
			t.Fatalf("missing audit %s", action)
		}
	}
	catalog := harness.expect("GET", "/api/v1/admin/automation/catalog", manager, nil, http.StatusOK)
	samples := harness.expect("GET", "/api/v1/admin/automation/sample-events", manager, nil, http.StatusOK)
	if len(catalog["events"].([]any)) != 4 || len(catalog["operators"].([]any)) != 6 || len(catalog["actions"].([]any)) != 3 || len(samples["items"].([]any)) == 0 {
		t.Fatalf("unexpected catalog %v %v", catalog, samples)
	}
}

func TestAutomationRulesHideReportedContentAndLogEveryRun(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	manager, stepUp := harness.staff("automation:manage")
	threshold := automationRuleContent("Hide repeated scams", map[string]any{"threshold": map[string]any{"count": 2, "withinSeconds": 3600}})
	harness.expect("PUT", "/api/v1/admin/automation/rules/rule_hide_scams", manager, map[string]any{"expectedVersion": 0, "reason": "Brigading protection", "content": threshold}, http.StatusCreated, stepUp...)
	flagBlasts := automationRuleContent("Flag message blasts", map[string]any{
		"event": "message.sent", "conditions": []any{map[string]any{"field": "recipientCount", "operator": "GREATER_THAN", "value": "20"}},
		"actions": []any{map[string]any{"type": "flag_user", "parameters": map[string]any{"priority": "30"}}},
	})
	harness.expect("PUT", "/api/v1/admin/automation/rules/rule_flag_blasts", manager, map[string]any{"expectedVersion": 0, "reason": "Spam wave response", "content": flagBlasts}, http.StatusCreated, stepUp...)

	author := uuid.NewString()
	harness.targets.own("product", "prd-auto", author)
	handler := harness.contentReportHandler()
	for _, reason := range []string{"spam", "scam_or_fraud", "scam_or_fraud"} {
		if err := handler(context.Background(), reportCreatedEnvelope(uuid.NewString(), "product", "prd-auto", reason, "")); err != nil {
			t.Fatal(err)
		}
	}
	sender := uuid.NewString()
	for _, recipients := range []int{3, 40} {
		if err := handler(context.Background(), messageSentEnvelope(sender, recipients)); err != nil {
			t.Fatal(err)
		}
	}
	viewer, _ := harness.staff("moderation:reports")
	products := harness.expect("GET", "/api/v1/admin/reports?targetType=product", viewer, nil, http.StatusOK)["data"].([]any)
	if len(products) != 1 || products[0].(map[string]any)["target"].(map[string]any)["visibility"] != "HIDDEN" || products[0].(map[string]any)["priority"] != "URGENT" {
		t.Fatalf("the second scam report hides the product and raises priority: %v", products)
	}
	if !harness.waitForPublished("content.visibilityChanged") {
		t.Fatal("the owning service hides the product")
	}
	if !harness.audit.has("report.automation_hide") {
		t.Fatal("the automation hide is recorded in the audit log")
	}
	flagged := harness.expect("GET", "/api/v1/admin/reports?targetType=user&source=automation", viewer, nil, http.StatusOK)["data"].([]any)
	if len(flagged) != 1 || flagged[0].(map[string]any)["target"].(map[string]any)["id"] != sender {
		t.Fatalf("the sender is flagged for review: %v", flagged)
	}
	runs := harness.expect("GET", "/api/v1/admin/automation/executions?ruleId=rule_hide_scams", manager, nil, http.StatusOK)["items"].([]any)
	outcomes := []any{}
	for _, run := range runs {
		outcomes = append(outcomes, run.(map[string]any)["status"])
	}
	if len(runs) != 3 || outcomes[0] != "suppressed" || outcomes[1] != "succeeded" || outcomes[2] != "skipped" {
		t.Fatalf("runs are logged newest first: %v", outcomes)
	}
	if first := runs[1].(map[string]any); first["outcome"] != "ACTIONS_RUN" || first["actionsRun"].([]any)[0] != "hide_target" || first["ruleName"] != "Hide repeated scams" {
		t.Fatalf("unexpected run %v", first)
	}
	all := harness.expect("GET", "/api/v1/admin/automation/executions", manager, nil, http.StatusOK)["items"].([]any)
	if len(all) != 5 {
		t.Fatalf("the log spans every rule: %d", len(all))
	}
	if _, err := harness.database.Exec(`UPDATE automation_event_occurrences SET occurred_at = now() - interval '9 days' WHERE event = 'message.sent'`); err != nil {
		t.Fatal(err)
	}
	deleted, err := automationrules.DeleteExpiredOccurrences(context.Background(), harness.module.Container())
	if err != nil || deleted != 2 {
		t.Fatalf("occurrences older than 8 days are deleted: %d %v", deleted, err)
	}
}

func TestStoreRulesTreatAMissingEmailVerifiedFlagAsFalse(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	manager, stepUp := harness.staff("automation:manage")
	rule := automationRuleContent("Flag unverified sellers", map[string]any{
		"event": "store.created", "conditions": []any{map[string]any{"field": "emailVerified", "operator": "EQUALS", "value": "false"}},
		"actions": []any{map[string]any{"type": "flag_user", "parameters": map[string]any{"priority": "40"}}},
	})
	harness.expect("PUT", "/api/v1/admin/automation/rules/rule_unverified_sellers", manager, map[string]any{"expectedVersion": 0, "reason": "Email is the only identifier", "content": rule}, http.StatusCreated, stepUp...)
	hasPhone := automationRuleContent("Phone rule", map[string]any{"event": "store.created", "conditions": []any{map[string]any{"field": "hasPhone", "operator": "EQUALS", "value": "true"}}, "actions": []any{map[string]any{"type": "flag_user", "parameters": map[string]any{"priority": "40"}}}})
	harness.expect("PUT", "/api/v1/admin/automation/rules/rule_phone", manager, map[string]any{"expectedVersion": 0, "reason": "Phones are not a signal", "content": hasPhone}, http.StatusBadRequest, stepUp...)
	owner := uuid.NewString()
	data, _ := json.Marshal(map[string]any{"storeId": uuid.NewString(), "ownerAccountId": owner, "countryCode": "NG", "currency": "NGN"})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "store.created", "source": "commerce", "subject": "s", "schemaVersion": 1, "occurredAt": time.Now().UTC().Format(time.RFC3339), "data": json.RawMessage(data)})
	if err := harness.contentReportHandler()(context.Background(), envelope); err != nil {
		t.Fatal(err)
	}
	viewer, _ := harness.staff("moderation:reports")
	flagged := harness.expect("GET", "/api/v1/admin/reports?targetType=user&source=automation", viewer, nil, http.StatusOK)["data"].([]any)
	if len(flagged) != 1 || flagged[0].(map[string]any)["target"].(map[string]any)["id"] != owner {
		t.Fatalf("a summary without emailVerified counts as unverified: %v", flagged)
	}
}
