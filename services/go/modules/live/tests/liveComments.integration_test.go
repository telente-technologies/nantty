package live_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"nantty/modules/live/src/interfaces"
)

func (harness *liveHarness) comment(liveId string, user liveUser, text string, want int) map[string]any {
	harness.t.Helper()
	return harness.expect("POST", "/api/v1/lives/"+liveId+"/comments", &user, "", map[string]any{"text": text}, want)
}

func TestCommentsArePersistedListedNewestFirstAndPaged(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	for index := 0; index < 3; index++ {
		harness.clock.Advance(5 * time.Second)
		created := harness.comment(liveId, viewer, "hello number "+string(rune('a'+index)), http.StatusCreated)
		if created["kind"] != "comment" || created["author"].(map[string]any)["id"] != viewer.id.String() {
			t.Fatalf("unexpected comment %v", created)
		}
	}
	page := harness.expect("GET", "/api/v1/lives/"+liveId+"/comments?order=newest&limit=2", &viewer, "", nil, http.StatusOK)
	items := page["data"].([]any)
	if len(items) != 2 || items[0].(map[string]any)["text"] != "hello number c" || page["nextCursor"] == nil {
		t.Fatalf("expected newest first with a cursor: %v", page)
	}
	rest := harness.expect("GET", "/api/v1/lives/"+liveId+"/comments?order=newest&limit=2&cursor="+page["nextCursor"].(string), &viewer, "", nil, http.StatusOK)
	if len(rest["data"].([]any)) != 1 || rest["nextCursor"] != nil {
		t.Fatalf("second page wrong: %v", rest)
	}
	oldest := harness.expect("GET", "/api/v1/lives/"+liveId+"/comments", &viewer, "", nil, http.StatusOK)["data"].([]any)
	if len(oldest) != 3 || oldest[0].(map[string]any)["text"] != "hello number a" || oldest[2].(map[string]any)["text"] != "hello number c" {
		t.Fatalf("default order is oldest first for appending: %v", oldest)
	}
	harness.waitForEvent("liveComment.created")
	harness.expect("GET", "/api/v1/lives/"+liveId+"/comments", nil, "", nil, http.StatusUnauthorized)
}

func TestBlockedWordsSlowModeAndCommentsSwitch(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	viewer := harness.newUser("viewer", "buyer")
	liveId := harness.goLive(host, nil)
	harness.expect("PUT", "/api/v1/lives/"+liveId+"/room-settings", &viewer, "", map[string]any{"slowModeSeconds": 10}, http.StatusForbidden)
	settings := harness.expect("PUT", "/api/v1/lives/"+liveId+"/room-settings", &host, "", map[string]any{"slowModeSeconds": 10, "blockedWords": []string{"Scam", "rip off"}}, http.StatusOK)
	if settings["slowModeSeconds"] != float64(10) || len(settings["blockedWords"].([]any)) != 2 {
		t.Fatalf("settings not saved: %v", settings)
	}
	blocked := harness.comment(liveId, viewer, "this is a SCAM!", http.StatusUnprocessableEntity)
	if blocked["code"] != "COMMENT_NOT_ALLOWED" {
		t.Fatalf("expected blocked word rejection %v", blocked)
	}
	harness.comment(liveId, viewer, "a total rip-off", http.StatusUnprocessableEntity)
	harness.comment(liveId, viewer, "platformbad", http.StatusUnprocessableEntity)
	harness.comment(liveId, viewer, "scammers aside, nice stream", http.StatusCreated)
	slow := harness.comment(liveId, viewer, "again quickly", http.StatusTooManyRequests)
	if slow["code"] != "SLOW_MODE" {
		t.Fatalf("expected slow mode %v", slow)
	}
	harness.comment(liveId, host, "host ignores slow mode", http.StatusCreated)
	harness.comment(liveId, host, "and again", http.StatusCreated)
	harness.clock.Advance(11 * time.Second)
	harness.comment(liveId, viewer, "after the wait", http.StatusCreated)
	harness.expect("PUT", "/api/v1/lives/"+liveId+"/room-settings", &host, "", map[string]any{"commentsEnabled": false}, http.StatusOK)
	harness.clock.Advance(11 * time.Second)
	off := harness.comment(liveId, viewer, "nobody home", http.StatusConflict)
	if off["code"] != "COMMENTS_DISABLED" {
		t.Fatalf("expected comments disabled %v", off)
	}
	harness.comment(liveId, host, "host can still speak", http.StatusCreated)
	harness.expect("PUT", "/api/v1/lives/"+liveId+"/room-settings", &host, "", map[string]any{"slowModeSeconds": 999}, http.StatusBadRequest)
	if code := harness.comment(liveId, host, strings.Repeat("x", 301), http.StatusUnprocessableEntity)["code"]; code != "COMMENT_TOO_LONG" {
		t.Fatalf("expected COMMENT_TOO_LONG got %v", code)
	}
}

func TestPinDeleteModeratorsMuteAndBan(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	moderator := harness.newUser("mod", "buyer")
	viewer := harness.newUser("viewer", "buyer")
	other := harness.newUser("other", "buyer")
	liveId := harness.goLive(host, nil)
	base := "/api/v1/lives/" + liveId
	first := harness.comment(liveId, viewer, "pin me please", http.StatusCreated)["id"].(string)
	harness.clock.Advance(5 * time.Second)
	second := harness.comment(liveId, other, "delete me", http.StatusCreated)["id"].(string)
	harness.expect("PUT", base+"/comments/"+first+"/pin", &viewer, "", nil, http.StatusForbidden)
	harness.expect("PUT", base+"/moderators/"+moderator.id.String(), &moderator, "", nil, http.StatusForbidden)
	harness.expect("PUT", base+"/moderators/"+moderator.id.String(), &host, "", nil, http.StatusNoContent)
	if listed := harness.expect("GET", base+"/moderators", &host, "", nil, http.StatusOK)["data"].([]any); len(listed) != 1 {
		t.Fatalf("expected one moderator %v", listed)
	}
	pinned := harness.expect("PUT", base+"/comments/"+first+"/pin", &moderator, "", nil, http.StatusOK)
	if pinned["pinned"] != true {
		t.Fatalf("pin failed %v", pinned)
	}
	room := harness.expect("GET", base+"/room-settings", &viewer, "", nil, http.StatusOK)
	if room["pinnedComment"].(map[string]any)["id"] != first || room["myRole"] != "viewer" || room["blockedWords"] != nil {
		t.Fatalf("viewer room view wrong %v", room)
	}
	harness.expect("DELETE", base+"/comments/"+second, &viewer, "", nil, http.StatusForbidden)
	harness.expect("DELETE", base+"/comments/"+second, &moderator, "", nil, http.StatusNoContent)
	harness.expect("DELETE", base+"/comments/"+second, &moderator, "", nil, http.StatusNotFound)
	harness.expect("DELETE", base+"/comments/"+first, &viewer, "", nil, http.StatusNoContent)
	if room = harness.expect("GET", base+"/room-settings", &viewer, "", nil, http.StatusOK); room["pinnedComment"] != nil {
		t.Fatalf("deleting the pinned comment must unpin it %v", room)
	}
	harness.expect("PUT", base+"/viewers/"+host.id.String()+"/mute", &moderator, "", nil, http.StatusUnprocessableEntity)
	muted := harness.expect("PUT", base+"/viewers/"+viewer.id.String()+"/mute", &moderator, "", map[string]any{"durationMinutes": 5}, http.StatusOK)
	if muted["kind"] != "muted" || muted["expiresAt"] == nil {
		t.Fatalf("mute response %v", muted)
	}
	harness.clock.Advance(5 * time.Second)
	if code := harness.comment(liveId, viewer, "muted now", http.StatusForbidden)["code"]; code != "VIEWER_MUTED" {
		t.Fatalf("expected VIEWER_MUTED got %v", code)
	}
	harness.clock.Advance(6 * time.Minute)
	harness.comment(liveId, viewer, "mute expired", http.StatusCreated)
	harness.expect("PUT", base+"/viewers/"+viewer.id.String()+"/mute", &host, "", nil, http.StatusOK)
	harness.expect("DELETE", base+"/viewers/"+viewer.id.String()+"/mute", &host, "", nil, http.StatusNoContent)
	harness.clock.Advance(5 * time.Second)
	harness.comment(liveId, viewer, "unmuted", http.StatusCreated)
	harness.expect("POST", base+"/join", &viewer, "", nil, http.StatusNoContent)
	harness.expect("PUT", base+"/viewers/"+viewer.id.String()+"/ban", &moderator, "", nil, http.StatusOK)
	if code := harness.comment(liveId, viewer, "banned now", http.StatusForbidden)["code"]; code != "VIEWER_BANNED" {
		t.Fatalf("expected VIEWER_BANNED got %v", code)
	}
	harness.expect("POST", base+"/join", &viewer, "", nil, http.StatusForbidden)
	harness.expect("POST", base+"/media-token", &viewer, "", nil, http.StatusForbidden)
	harness.expect("GET", base+"/comments", &viewer, "", nil, http.StatusForbidden)
	if viewers := harness.expect("GET", base, &host, "", nil, http.StatusOK)["viewers"]; viewers != float64(0) {
		t.Fatalf("ban must remove the viewer from the count, got %v", viewers)
	}
	harness.expect("DELETE", base+"/viewers/"+viewer.id.String()+"/ban", &host, "", nil, http.StatusNoContent)
	harness.expect("POST", base+"/join", &viewer, "", nil, http.StatusNoContent)
	harness.waitForEvent("liveViewer.banned")
	harness.waitForEvent("liveComment.pinned")
}

func TestMentionsFollowSocialRules(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	author := harness.newUser("author", "buyer")
	friendly := harness.newUser("friendly", "buyer")
	blocker := harness.newUser("blocker", "buyer")
	private := harness.newUser("private", "buyer")
	followingOnly := harness.newUser("followingonly", "buyer")
	harness.relations.Block(blocker.id, author.id)
	harness.relations.SetMentionPrivacy(private.id, interfaces.MentionNobody)
	harness.relations.SetMentionPrivacy(followingOnly.id, interfaces.MentionFollowing)
	liveId := harness.goLive(host, nil)
	text := "@friendly @blocker @private @followingonly @author"
	mentions := []map[string]any{
		{"userId": friendly.id.String(), "start": 0, "length": 9}, {"userId": blocker.id.String(), "start": 10, "length": 8},
		{"userId": private.id.String(), "start": 19, "length": 8}, {"userId": followingOnly.id.String(), "start": 28, "length": 14},
		{"userId": author.id.String(), "start": 43, "length": 7}, {"userId": friendly.id.String(), "start": 3, "length": 4},
	}
	created := harness.expect("POST", "/api/v1/lives/"+liveId+"/comments", &author, "", map[string]any{"text": text, "mentions": mentions}, http.StatusCreated)
	kept := created["mentions"].([]any)
	if len(kept) != 1 || kept[0].(map[string]any)["userId"] != friendly.id.String() || kept[0].(map[string]any)["username"] == "" {
		t.Fatalf("only the friendly, unblocked, unrestricted mention survives: %v", kept)
	}
	harness.relations.Follow(followingOnly.id, author.id)
	harness.clock.Advance(5 * time.Second)
	again := harness.expect("POST", "/api/v1/lives/"+liveId+"/comments", &author, "", map[string]any{"text": "@followingonly hi", "mentions": []map[string]any{{"userId": followingOnly.id.String(), "start": 0, "length": 14}}}, http.StatusCreated)
	if len(again["mentions"].([]any)) != 1 {
		t.Fatalf("following-only target who follows the author may be mentioned: %v", again)
	}
	tooMany := make([]map[string]any, 21)
	for index := range tooMany {
		tooMany[index] = map[string]any{"userId": friendly.id.String(), "start": 0, "length": 2}
	}
	harness.clock.Advance(5 * time.Second)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/comments", &author, "", map[string]any{"text": "@x", "mentions": tooMany}, http.StatusBadRequest)
}
