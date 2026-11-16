package controllers_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/sellerConversations/controllers"
	"nantty/platform/httpserver"
)

func TestReplyHandlerRejectsPlaintextBeforeReadingStoreOrMessageState(t *testing.T) {
	plaintextBodies := map[string]string{
		"body":          `{"body":"Your order shipped"}`,
		"text":          `{"text":"hi"}`,
		"location":      `{"location":{"latitude":6.5,"longitude":3.3}}`,
		"poll":          `{"poll":{"question":"q","options":["a","b"]}}`,
		"document":      `{"document":{"fileName":"invoice.pdf"}}`,
		"sharedContent": `{"sharedContent":{"kind":"product","id":"p1"}}`,
	}
	controller := controllers.SellerConversationsController{Container: &container.Container{Logger: slog.Default()}}
	for name, body := range plaintextBodies {
		t.Run(name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/v1/seller/conversations/00000000-0000-0000-0000-000000000001/messages", strings.NewReader(body))
			request.SetPathValue("conversationId", uuid.NewString())
			recorder := httptest.NewRecorder()
			controller.Reply(recorder, request)
			var response httpserver.ApiError
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatalf("decode error response: %v (%s)", err, recorder.Body.String())
			}
			if recorder.Code != http.StatusUnprocessableEntity || response.Code != "PLAINTEXT_NOT_ACCEPTED" {
				t.Fatalf("got %d %q, want 422 PLAINTEXT_NOT_ACCEPTED", recorder.Code, response.Code)
			}
		})
	}
}
