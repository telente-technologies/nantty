package live

import (
	"net/http"
	"strings"
	"testing"
)

func TestStreamKeysIssueRotateRevokeAndNeverAppearInLogs(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	other := harness.newUser("other", "creator")
	liveId := harness.goLive(host, nil)
	path := "/api/v1/lives/" + liveId + "/stream-key"
	harness.expect("GET", path, &host, "", nil, http.StatusNotFound)
	harness.expect("POST", path, &other, "", nil, http.StatusForbidden)
	harness.expect("POST", path+"?protocol=srt", &host, "", nil, http.StatusBadRequest)
	first := harness.expect("POST", path, &host, "", nil, http.StatusOK)
	if first["protocol"] != "rtmp" || first["streamKey"] == "" || first["ingestUrl"] != "rtmp://ingest.test/x" || first["streamKeyHint"] != first["streamKey"].(string)[len(first["streamKey"].(string))-4:] {
		t.Fatalf("unexpected key view %v", first)
	}
	harness.expect("GET", path, &other, "", nil, http.StatusForbidden)
	read := harness.expect("GET", path, &host, "", nil, http.StatusOK)
	if read["streamKey"] != first["streamKey"] {
		t.Fatalf("get must return the active key")
	}
	rotated := harness.expect("POST", path, &host, "", nil, http.StatusOK)
	if rotated["streamKey"] == first["streamKey"] || len(harness.ingress.Deleted) != 1 {
		t.Fatalf("rotation must change the key and delete the old ingress: %v deleted=%v", rotated, harness.ingress.Deleted)
	}
	whip := harness.expect("POST", path+"?protocol=whip", &host, "", nil, http.StatusOK)
	if whip["protocol"] != "whip" {
		t.Fatalf("whip ingest expected %v", whip)
	}
	listed := harness.expect("GET", "/api/v1/lives", &host, "", nil, http.StatusOK)["data"].([]any)
	if len(listed) != 1 || listed[0].(map[string]any)["streamKeyHint"] == nil {
		t.Fatalf("studio list must carry only the key hint: %v", listed)
	}
	if strings.Contains(toJson(listed), rotated["streamKey"].(string)) {
		t.Fatalf("the list must never include a full stream key")
	}
	harness.expect("DELETE", path, &host, "", nil, http.StatusNoContent)
	harness.expect("GET", path, &host, "", nil, http.StatusNotFound)
	reissued := harness.expect("POST", path, &host, "", nil, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	harness.expect("GET", path, &host, "", nil, http.StatusNotFound)
	harness.expect("POST", path, &host, "", nil, http.StatusConflict)
	if len(harness.ingress.Active) != 0 {
		t.Fatalf("ending the live must revoke every ingress, still active: %v", harness.ingress.Active)
	}
	logs := harness.logs.String()
	for _, secret := range []string{first["streamKey"].(string), rotated["streamKey"].(string), whip["streamKey"].(string), reissued["streamKey"].(string)} {
		if strings.Contains(logs, secret) {
			t.Fatalf("a stream key leaked into the logs")
		}
	}
}
