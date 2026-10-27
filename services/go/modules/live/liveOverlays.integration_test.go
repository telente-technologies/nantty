package live

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

func toJson(value any) string {
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func sampleLayers() []map[string]any {
	return []map[string]any{
		{"id": "layer_a", "type": "text", "name": "Lower third", "x": 64, "y": 900, "width": 720, "height": 96, "zIndex": 10, "opacity": 0.95, "text": "Hello", "fontSize": 44, "color": "#ffffff", "background": "#0b1752", "radius": 8},
		{"id": "layer_b", "type": "image", "name": "Logo", "x": 1690, "y": 48, "width": 180, "height": 180, "zIndex": 20, "opacity": 1, "src": "https://cdn.nantty.com/logo.png"},
	}
}

func TestMainOverlaySceneMatchesStudioContractAndUsesOpaqueIds(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	other := harness.newUser("other", "creator")
	liveId := harness.goLive(host, nil)
	path := "/api/v1/lives/" + liveId + "/overlays"
	harness.expect("GET", path, &other, "", nil, http.StatusForbidden)
	empty := harness.expect("GET", path, &host, "", nil, http.StatusOK)
	sceneId := empty["id"].(string)
	if !strings.HasPrefix(sceneId, "scn_") || strings.Contains(sceneId, liveId) || sceneId == "scene_"+liveId || len(sceneId) < 20 || empty["liveId"] != liveId || len(empty["layers"].([]any)) != 0 || empty["published"] != false {
		t.Fatalf("scene ids must be opaque and unguessable: %v", empty)
	}
	harness.expect("GET", "/api/v1/overlay-scenes/"+sceneId, nil, "", nil, http.StatusNotFound)
	harness.expect("GET", "/api/v1/overlay-scenes/scene_"+liveId, nil, "", nil, http.StatusNotFound)
	saved := harness.expect("PUT", path, &host, "", map[string]any{"name": "Main", "layers": sampleLayers()}, http.StatusOK)
	if saved["id"] != sceneId || saved["published"] != true || saved["name"] != "Main" || len(saved["layers"].([]any)) != 2 {
		t.Fatalf("saving the main scene publishes by default: %v", saved)
	}
	public := harness.expect("GET", "/api/v1/overlay-scenes/"+sceneId, nil, "", nil, http.StatusOK)
	if public["live"].(map[string]any)["id"] != liveId || public["live"].(map[string]any)["state"] != "live" || len(public["scene"].(map[string]any)["layers"].([]any)) != 2 {
		t.Fatalf("public scene wrong: %v", public)
	}
	harness.expect("PUT", path, &host, "", map[string]any{"layers": sampleLayers(), "publish": false, "name": "Draft only"}, http.StatusOK)
	stillPublic := harness.expect("GET", "/api/v1/overlay-scenes/"+sceneId, nil, "", nil, http.StatusOK)
	if stillPublic["scene"].(map[string]any)["name"] != "Main" {
		t.Fatalf("draft edits must not leak to the public page: %v", stillPublic)
	}
	harness.expect("PUT", path, &host, "", map[string]any{"layers": []map[string]any{{"id": "x", "type": "text", "name": "bad", "x": 0, "y": 0, "width": 10, "height": 10, "zIndex": 1, "opacity": 3}}}, http.StatusBadRequest)
	harness.expect("PUT", path, &host, "", map[string]any{"layers": []map[string]any{{"id": "x", "type": "image", "name": "bad", "x": 0, "y": 0, "width": 10, "height": 10, "zIndex": 1, "opacity": 1, "src": "http://insecure.example/x.png"}}}, http.StatusBadRequest)
	harness.expect("PUT", path, &host, "", map[string]any{"layers": []map[string]any{{"id": "x", "type": "text", "name": "bad", "x": 0, "y": 0, "width": 10, "height": 10, "zIndex": 1, "opacity": 1, "surprise": true}}}, http.StatusBadRequest)
	harness.waitForEvent("overlayScene.published")
}

func TestOverlaySceneCrudPublishVisibilityAndLimits(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	other := harness.newUser("other", "creator")
	liveId := harness.goLive(host, nil)
	base := "/api/v1/lives/" + liveId + "/overlay-scenes"
	harness.expect("POST", base, &other, "", map[string]any{"name": "Nope"}, http.StatusForbidden)
	first := harness.expect("POST", base, &host, "", map[string]any{"name": "Intro", "layers": sampleLayers()}, http.StatusCreated)
	second := harness.expect("POST", base, &host, "", map[string]any{"name": "Outro"}, http.StatusCreated)
	if first["isMain"] != true || second["isMain"] != false || first["id"] == second["id"] {
		t.Fatalf("first scene is main %v %v", first, second)
	}
	sceneId := second["id"].(string)
	harness.expect("GET", base+"/"+sceneId, &other, "", nil, http.StatusForbidden)
	harness.expect("GET", base+"/scn_doesnotexist", &host, "", nil, http.StatusNotFound)
	updated := harness.expect("PUT", base+"/"+sceneId, &host, "", map[string]any{"name": "Outro v2", "layers": sampleLayers()}, http.StatusOK)
	if updated["name"] != "Outro v2" || updated["published"] != false || updated["revision"] != float64(2) {
		t.Fatalf("update keeps the scene private until published: %v", updated)
	}
	harness.expect("GET", "/api/v1/overlay-scenes/"+sceneId, nil, "", nil, http.StatusNotFound)
	published := harness.expect("POST", base+"/"+sceneId+"/publish", &host, "", nil, http.StatusOK)
	if published["published"] != true {
		t.Fatalf("publish failed %v", published)
	}
	harness.expect("GET", "/api/v1/overlay-scenes/"+sceneId, nil, "", nil, http.StatusOK)
	harness.expect("DELETE", base+"/"+sceneId+"/publish", &host, "", nil, http.StatusOK)
	harness.expect("GET", "/api/v1/overlay-scenes/"+sceneId, nil, "", nil, http.StatusNotFound)
	harness.expect("POST", base+"/"+sceneId+"/publish", &host, "", nil, http.StatusOK)
	harness.expect("DELETE", base+"/"+first["id"].(string), &host, "", nil, http.StatusUnprocessableEntity)
	harness.expect("DELETE", base+"/"+sceneId, &host, "", nil, http.StatusNoContent)
	harness.expect("GET", "/api/v1/overlay-scenes/"+sceneId, nil, "", nil, http.StatusNotFound)
	for index := 0; index < 9; index++ {
		harness.expect("POST", base, &host, "", map[string]any{"name": "Extra"}, http.StatusCreated)
	}
	if code := harness.expect("POST", base, &host, "", map[string]any{"name": "Too many"}, http.StatusUnprocessableEntity)["code"]; code != "SCENE_LIMIT_REACHED" {
		t.Fatalf("expected SCENE_LIMIT_REACHED got %v", code)
	}
	if listed := harness.expect("GET", base, &host, "", nil, http.StatusOK)["data"].([]any); len(listed) != 10 {
		t.Fatalf("expected 10 scenes got %d", len(listed))
	}
}

func TestPublishedSceneDisappearsAfterTheLiveEnded(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "creator")
	liveId := harness.goLive(host, nil)
	scene := harness.expect("PUT", "/api/v1/lives/"+liveId+"/overlays", &host, "", map[string]any{"layers": sampleLayers()}, http.StatusOK)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	harness.clock.Advance(5 * time.Minute)
	ended := harness.expect("GET", "/api/v1/overlay-scenes/"+scene["id"].(string), nil, "", nil, http.StatusOK)
	if ended["live"].(map[string]any)["state"] != "ended" {
		t.Fatalf("scene stays reachable briefly after the live ends %v", ended)
	}
	harness.clock.Advance(2 * time.Hour)
	harness.expect("GET", "/api/v1/overlay-scenes/"+scene["id"].(string), nil, "", nil, http.StatusNotFound)
}
