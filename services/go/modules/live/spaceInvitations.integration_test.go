package live

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestPendingSpaceInvitationsAreRecipientScopedAndPaginated(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	recipient := harness.newUser("invite-recipient", "buyer")
	otherRecipient := harness.newUser("other-recipient", "buyer")
	hosts := []liveUser{
		harness.newUser("space-host-one", "creator"),
		harness.newUser("space-host-two", "creator"),
		harness.newUser("space-host-three", "creator"),
	}
	spaceIDs := make([]string, 0, len(hosts))
	for index, host := range hosts {
		created := harness.expect("POST", "/api/v1/spaces", &host, fmt.Sprintf("space-create-%d", index), map[string]any{
			"title":       fmt.Sprintf("Invitation Space %d", index+1),
			"description": "A recipient-scoped summary",
			"visibility":  "invite_only",
			"scheduledAt": harness.clock.Now().Add(time.Hour).Format(time.RFC3339Nano),
		}, http.StatusCreated)
		spaceIDs = append(spaceIDs, created["id"].(string))
		invitee := recipient
		if index == 2 {
			invitee = otherRecipient
		}
		harness.expect("POST", "/api/v1/spaces/"+spaceIDs[index]+"/invites", &host, fmt.Sprintf("space-invite-%d", index), map[string]any{
			"accountId": invitee.id.String(), "role": "speaker", "title": fmt.Sprintf("Guest %d", index+1),
		}, http.StatusNoContent)
		harness.clock.Advance(time.Second)
	}
	cancelledHost := harness.newUser("space-host-cancelled", "creator")
	cancelledSpace := harness.expect("POST", "/api/v1/spaces", &cancelledHost, "space-create-cancelled", map[string]any{
		"title": "Cancelled Invitation Space", "visibility": "invite_only",
		"scheduledAt": harness.clock.Now().Add(time.Hour).Format(time.RFC3339Nano),
	}, http.StatusCreated)
	cancelledSpaceID := cancelledSpace["id"].(string)
	harness.expect("POST", "/api/v1/spaces/"+cancelledSpaceID+"/invites", &cancelledHost, "space-invite-cancelled", map[string]any{
		"accountId": recipient.id.String(), "role": "speaker", "title": "Cancelled guest",
	}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/spaces/"+cancelledSpaceID+"/cancel", &cancelledHost, "space-cancel-invited", nil, http.StatusNoContent)
	endedHost := harness.newUser("space-host-ended", "creator")
	endedSpace := harness.expect("POST", "/api/v1/spaces", &endedHost, "space-create-ended", map[string]any{
		"title": "Ended Invitation Space", "visibility": "invite_only",
		"scheduledAt": harness.clock.Now().Add(time.Hour).Format(time.RFC3339Nano),
	}, http.StatusCreated)
	endedSpaceID := endedSpace["id"].(string)
	harness.expect("POST", "/api/v1/spaces/"+endedSpaceID+"/invites", &endedHost, "space-invite-ended", map[string]any{
		"accountId": recipient.id.String(), "role": "speaker", "title": "Ended guest",
	}, http.StatusNoContent)
	if _, err := harness.module.Container.Client.ExecContext(context.Background(), `UPDATE spaces SET state = 'ended' WHERE id = $1`, endedSpaceID); err != nil {
		t.Fatal(err)
	}
	// A corrupt timestamp on a matching legacy JSON object must be skipped,
	// rather than making the recipient's entire list fail during SQL casting.
	if _, err := harness.module.Container.Client.ExecContext(context.Background(), `
UPDATE spaces
SET metadata = jsonb_set(
	COALESCE(metadata, '{}'::jsonb),
	'{spaceInvitations}',
	COALESCE(metadata->'spaceInvitations', '[]'::jsonb) ||
	jsonb_build_array(jsonb_build_object(
		'id', $2::text, 'accountId', $3::text, 'role', 'speaker', 'status', 'pending', 'invitedAt', 'not-a-timestamp'
	)),
	true
)
WHERE id = $1`, spaceIDs[2], "malformed-invite-id", recipient.id.String()); err != nil {
		t.Fatal(err)
	}

	page := harness.expect("GET", "/api/v1/spaces/invitations?limit=1", &recipient, "", nil, http.StatusOK)
	data, ok := page["data"].([]any)
	if !ok || len(data) != 1 {
		t.Fatalf("first page data = %#v, want exactly one invitation", page["data"])
	}
	first := data[0].(map[string]any)
	if first["spaceId"] != spaceIDs[1] || first["role"] != "speaker" || first["title"] != "Guest 2" || first["inviterId"] != hosts[1].id.String() {
		t.Fatalf("invitation fields mismatch (ended/cancelled pending invitations must be hidden): %#v", first)
	}
	spaceSummary, ok := first["space"].(map[string]any)
	if !ok || spaceSummary["id"] != spaceIDs[1] || spaceSummary["title"] != "Invitation Space 2" || spaceSummary["visibility"] != "invite_only" {
		t.Fatalf("Space summary missing or unsafe: %#v", first["space"])
	}
	if _, leaked := first["accountId"]; leaked {
		t.Fatalf("recipient account id must not be returned: %#v", first)
	}
	cursor, ok := page["nextCursor"].(string)
	if !ok || cursor == "" {
		t.Fatalf("nextCursor = %#v, want cursor for second page", page["nextCursor"])
	}
	second := harness.expect("GET", "/api/v1/spaces/invitations?limit=1&cursor="+cursor, &recipient, "", nil, http.StatusOK)
	secondData := second["data"].([]any)
	if len(secondData) != 1 || secondData[0].(map[string]any)["spaceId"] != spaceIDs[0] || second["nextCursor"] != nil {
		t.Fatalf("second recipient page must contain only its remaining invite: %#v", second)
	}
	otherPage := harness.expect("GET", "/api/v1/spaces/invitations", &otherRecipient, "", nil, http.StatusOK)
	otherData := otherPage["data"].([]any)
	if len(otherData) != 1 || otherData[0].(map[string]any)["spaceId"] != spaceIDs[2] {
		t.Fatalf("other recipient should see only their invite: %#v", otherPage)
	}
	if otherPage["nextCursor"] != nil {
		t.Fatalf("single-item result should not have another page: %#v", otherPage["nextCursor"])
	}
	assertSpaceInvitationIndexUsable(t, harness, recipient)
}

func assertSpaceInvitationIndexUsable(t *testing.T, harness *liveHarness, recipient liveUser) {
	t.Helper()
	tx, err := harness.module.Container.Client.Tx(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(context.Background(), "SET LOCAL enable_seqscan = off"); err != nil {
		t.Fatal(err)
	}
	rows, err := tx.QueryContext(context.Background(), `EXPLAIN (COSTS OFF)
SELECT id FROM spaces
WHERE metadata->'spaceInvitations' @> jsonb_build_array(
	jsonb_build_object('accountId', $1::text, 'status', 'pending')
)`, recipient.id.String())
	if err != nil {
		t.Fatalf("EXPLAIN pending invitation recipient query: %v", err)
	}
	defer rows.Close()
	var plan strings.Builder
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			t.Fatal(err)
		}
		plan.WriteString(line)
		plan.WriteByte('\n')
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(plan.String(), "space_invitation_recipient_pending") {
		t.Fatalf("recipient lookup plan does not use the targeted GIN index:\n%s", plan.String())
	}
}
