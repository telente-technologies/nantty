package controllers

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"nantty/modules/live/src/container"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/interfaces"
	"nantty/platform/jwtauth"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type failOnceSpaceProfile struct {
	calls int
	host  uuid.UUID
}

func (d *failOnceSpaceProfile) LookupParticipants(context.Context, []uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	d.calls++
	if d.calls == 2 {
		return nil, errors.New("directory temporarily unavailable")
	}
	return map[uuid.UUID]interfaces.Participant{d.host: {Id: d.host, Name: "Creator", IsCreatorProgramMember: true}}, nil
}

// Exercise the actual Create handler, intercepting persistence rather than needing a DB.
func TestSpaceCreateDirectoryFailureThenSameKeyRetryPersistsOnce(t *testing.T) {
	host := uuid.New()
	directory := &failOnceSpaceProfile{host: host}
	client := ent.NewClient()
	client.LiveHostRestriction.Intercept(ent.InterceptFunc(func(ent.Querier) ent.Querier {
		return ent.QuerierFunc(func(context.Context, ent.Query) (ent.Value, error) { return []string{}, nil })
	}))
	persisted := 0
	spaceGiftsEnabled := false
	client.Space.Use(func(ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(_ context.Context, m ent.Mutation) (ent.Value, error) {
			persisted++
			mutation := m.(*ent.SpaceMutation)
			title, _ := mutation.Title()
			description, _ := mutation.Description()
			scheduled, _ := mutation.ScheduledAt()
			spaceGiftsEnabled, _ = mutation.GiftsEnabled()
			return &ent.Space{ID: uuid.New(), HostID: host, Title: title, Description: description, State: space.StateScheduled, ScheduledAt: &scheduled}, nil
		})
	})
	now := time.Now()
	controller := SpacesController{Container: &container.Container{Client: client, Directory: directory, Now: func() time.Time { return now }, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	for attempt, want := range []int{http.StatusInternalServerError, http.StatusCreated} {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/spaces", strings.NewReader(`{"title":"Retry safely","scheduledAt":"`+now.Add(time.Hour).Format(time.RFC3339)+`"}`))
		req.Header.Set("Idempotency-Key", "same-space-attempt")
		req = req.WithContext(jwtauth.ContextWithPrincipal(req.Context(), jwtauth.Principal{UserId: host.String(), Roles: []string{"creator"}}))
		response := httptest.NewRecorder()
		controller.Create(response, req)
		if response.Code != want {
			t.Fatalf("attempt %d: status=%d body=%s", attempt, response.Code, response.Body.String())
		}
		if persisted != attempt {
			t.Fatalf("attempt %d: persisted %d Spaces, want %d", attempt, persisted, attempt)
		}
	}
	if !spaceGiftsEnabled {
		t.Fatal("new Spaces must enable host-only coin gifts")
	}
}
