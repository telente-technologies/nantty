package moderation_test

import (
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"
)

func raceRequests(count int, send func(index int) int) map[int]int {
	var group sync.WaitGroup
	var mutex sync.Mutex
	statuses := map[int]int{}
	start := make(chan struct{})
	for index := range count {
		group.Add(1)
		go func() {
			defer group.Done()
			<-start
			status := send(index)
			mutex.Lock()
			statuses[status]++
			mutex.Unlock()
		}()
	}
	close(start)
	group.Wait()
	return statuses
}

func TestConcurrentCopyrightDecisionsLetOnlyOneWin(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	uploader := uuid.NewString()
	harness.targets.own("sound", "s-race", uploader)
	_, claimantToken := harness.reporter()
	claimId := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, copyrightClaimBody("sound", "s-race"), http.StatusCreated)["claimId"].(string)
	reviewer, stepUp := harness.staff("copyright:review")
	base := "/api/v1/admin/copyright-claims/" + claimId
	statuses := raceRequests(8, func(index int) int {
		action := map[bool]string{true: "/uphold", false: "/reject"}[index%2 == 0]
		status, _, _ := harness.call("POST", base+action, reviewer, map[string]string{"reason": "racing decision"}, stepUp...)
		return status
	})
	if statuses[http.StatusOK] != 1 || statuses[http.StatusConflict] != 7 {
		t.Fatalf("exactly one decision may win a race, got %v", statuses)
	}
	harness.targets.own("sound", "s-race-2", uploader)
	secondId := harness.expect("POST", "/api/v1/copyright/claims", claimantToken, copyrightClaimBody("sound", "s-race-2"), http.StatusCreated)["claimId"].(string)
	harness.expect("POST", "/api/v1/admin/copyright-claims/"+secondId+"/uphold", reviewer, map[string]string{"reason": "matches the master"}, http.StatusOK, stepUp...)
	uploaderToken := harness.tokens.SignAccountAccessToken(t, uploader)
	notices := raceRequests(6, func(int) int {
		status, _, _ := harness.call("POST", "/api/v1/copyright/claims/"+secondId+"/counter-notices", uploaderToken, map[string]any{"statement": "licensed sample", "contactEmail": "me@example.com", "goodFaith": true})
		return status
	})
	if notices[http.StatusCreated] != 1 || notices[http.StatusConflict] != 5 {
		t.Fatalf("only one counter-notice may open at a time, got %v", notices)
	}
}

func TestConcurrentIpClaimDecisionsLetOnlyOneWin(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	created := harness.expect("POST", "/api/v1/internal/ip-claims", "", ipClaimBody(uuid.NewString(), "prod-race"), http.StatusCreated, intakeToken...)
	reviewer, stepUp := harness.staff("ip-claims:review")
	base := "/api/v1/admin/ip-claims/" + created["claimId"].(string)
	statuses := raceRequests(8, func(index int) int {
		action := map[bool]string{true: "/uphold", false: "/reject"}[index%2 == 0]
		status, _, _ := harness.call("POST", base+action, reviewer, map[string]any{"reason": "racing decision"}, stepUp...)
		return status
	})
	if statuses[http.StatusOK] != 1 || statuses[http.StatusConflict] != 7 {
		t.Fatalf("exactly one ip-claim decision may win a race, got %v", statuses)
	}
}

func TestCopyrightClaimCannotCiteTheClaimedContentAsTheOriginalWork(t *testing.T) {
	harness := startModerationAgainstFreshSchema(t)
	harness.targets.own("clip", "c-self", uuid.NewString())
	_, claimantToken := harness.reporter()
	body := copyrightClaimBody("clip", "c-self")
	body["originalWorkMediaId"] = "media-c-self"
	harness.expect("POST", "/api/v1/copyright/claims", claimantToken, body, http.StatusBadRequest)
}
