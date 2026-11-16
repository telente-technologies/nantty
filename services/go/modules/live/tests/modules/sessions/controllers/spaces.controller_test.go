package controllers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/live/src/container"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
)

type spaceTestDirectory map[uuid.UUID]interfaces.Participant

func (directory spaceTestDirectory) LookupParticipants(_ context.Context, identifiers []uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	participants := make(map[uuid.UUID]interfaces.Participant)
	for _, id := range identifiers {
		if participant, ok := directory[id]; ok {
			participants[id] = participant
		}
	}
	return participants, nil
}

type recordingSpaceDirectory struct {
	calls        int
	identifiers  []uuid.UUID
	participants map[uuid.UUID]interfaces.Participant
}

func (directory *recordingSpaceDirectory) LookupParticipants(_ context.Context, identifiers []uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	directory.calls++
	directory.identifiers = append([]uuid.UUID(nil), identifiers...)
	return directory.participants, nil
}

type spaceListRelations struct {
	blocked, private, followed, subscribed map[uuid.UUID]bool
}

func (relations spaceListRelations) BlockedEitherWay(_ context.Context, _ uuid.UUID, others []uuid.UUID) (map[uuid.UUID]bool, error) {
	return selectSpaceRelation(others, relations.blocked), nil
}
func (relations spaceListRelations) IsFollowing(_ context.Context, follower, followee uuid.UUID) (bool, error) {
	return relations.followed[followee], nil
}
func (relations spaceListRelations) IsActiveSubscriber(_ context.Context, _, creator uuid.UUID) (bool, error) {
	return relations.subscribed[creator], nil
}
func (spaceListRelations) FollowCounts(context.Context, uuid.UUID) (int, int, error) {
	return 0, 0, nil
}
func (spaceListRelations) MentionPrivacyOf(context.Context, []uuid.UUID) (map[uuid.UUID]interfaces.MentionPrivacy, error) {
	return nil, nil
}
func (spaceListRelations) ListLiveAlertRecipients(context.Context, uuid.UUID, int) ([]uuid.UUID, bool, error) {
	return nil, false, nil
}
func (relations spaceListRelations) FollowedAmong(_ context.Context, _ uuid.UUID, candidates []uuid.UUID) (map[uuid.UUID]bool, error) {
	return selectSpaceRelation(candidates, relations.followed), nil
}
func (relations spaceListRelations) PrivateAccountsAmong(_ context.Context, users []uuid.UUID) (map[uuid.UUID]bool, error) {
	return selectSpaceRelation(users, relations.private), nil
}

func selectSpaceRelation(users []uuid.UUID, values map[uuid.UUID]bool) map[uuid.UUID]bool {
	selected := make(map[uuid.UUID]bool, len(users))
	for _, user := range users {
		selected[user] = values[user]
	}
	return selected
}

func TestPresentSpaceSummariesUsesMobileShapeAndFiltersInaccessibleRows(t *testing.T) {
	viewerID := uuid.New()
	publicHost, secondPublicHost, privateHost, blockedHost := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	directory := &recordingSpaceDirectory{participants: map[uuid.UUID]interfaces.Participant{
		publicHost:       {Id: publicHost, Name: "Public Host", Username: "public-host"},
		secondPublicHost: {Id: secondPublicHost, Name: "Second Host"},
	}}
	controller := SpacesController{Container: &container.Container{
		Directory: directory,
		Relations: spaceListRelations{
			private: map[uuid.UUID]bool{privateHost: true}, blocked: map[uuid.UUID]bool{blockedHost: true},
		},
	}}
	rows := []*ent.Space{
		{ID: uuid.New(), HostID: publicHost, Title: "Open room", State: space.StateLive, Listeners: 7, Visibility: space.VisibilityPublic, ModerationVisibility: "visible"},
		{ID: uuid.New(), HostID: secondPublicHost, Title: "Upcoming room", State: space.StateScheduled, Visibility: space.VisibilityPublic, ModerationVisibility: "visible"},
		{ID: uuid.New(), HostID: privateHost, Title: "Private profile", State: space.StateLive, Visibility: space.VisibilityPublic, ModerationVisibility: "visible"},
		{ID: uuid.New(), HostID: blockedHost, Title: "Blocked host", State: space.StateLive, Visibility: space.VisibilityPublic, ModerationVisibility: "visible"},
	}
	views, err := controller.presentSpaceSummaries(context.Background(), rows, &types.Actor{UserId: viewerID})
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 2 || views[0].Title != "Open room" || views[1].Title != "Upcoming room" {
		t.Fatalf("visible summaries = %#v, want only the two accessible Spaces", views)
	}
	if directory.calls != 1 || len(directory.identifiers) != 2 {
		t.Fatalf("directory calls/ids = %d/%v, want one batched call for accessible hosts", directory.calls, directory.identifiers)
	}
	encoded, err := json.Marshal(views[0])
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	host, ok := payload["host"].(map[string]any)
	if !ok || payload["id"] == nil || payload["listenerCount"] != float64(7) || host["id"] != publicHost.String() || host["name"] != "Public Host" || host["username"] != "public-host" {
		t.Fatalf("summary JSON does not match SpaceSummary: %s", encoded)
	}
	if _, exists := payload["host_id"]; exists {
		t.Fatalf("Ent field leaked in SpaceSummary JSON: %s", encoded)
	}
}

func TestSpaceHostAuthorization(t *testing.T) {
	host, other := uuid.New(), uuid.New()
	if !spaceHostAuthorized(host, host) {
		t.Fatal("host must be authorized")
	}
	if spaceHostAuthorized(host, other) {
		t.Fatal("non-host must be denied")
	}
}

func TestCoinContributionsRequireExplicitHostOptIn(t *testing.T) {
	enabled, disabled := true, false
	for _, test := range []struct {
		name       string
		preference *bool
		want       bool
	}{
		{name: "omitted preference defaults off"},
		{name: "explicitly disabled", preference: &disabled},
		{name: "explicitly enabled", preference: &enabled, want: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := coinContributionsEnabled(test.preference); got != test.want {
				t.Fatalf("coin contributions enabled = %v, want %v", got, test.want)
			}
		})
	}
}

func TestSpaceHostEligibilityRequiresCreatorProgramRole(t *testing.T) {
	tests := []struct {
		name     string
		roles    []string
		eligible bool
	}{
		{name: "creator member", roles: []string{"creator"}, eligible: true},
		{name: "seller only", roles: []string{"seller"}},
		{name: "admin without creator membership", roles: []string{"admin"}},
		{name: "unapproved account"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := spaceHostIsCreator(types.Actor{Roles: test.roles}); got != test.eligible {
				t.Fatalf("eligible = %v, want %v", got, test.eligible)
			}
		})
	}
}

func TestSpaceHostEligibilityUsesCurrentCreatorProgramMembership(t *testing.T) {
	userID := uuid.New()
	actor := types.Actor{UserId: userID, Roles: []string{"creator"}}
	tests := []struct {
		name    string
		dir     interfaces.ParticipantDirectory
		wantErr bool
	}{
		{name: "active member", dir: spaceTestDirectory{userID: {Id: userID, IsCreatorProgramMember: true}}},
		{name: "role removed from program", dir: spaceTestDirectory{userID: {Id: userID}}, wantErr: true},
		{name: "directory unavailable", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			controller := SpacesController{Container: &container.Container{Directory: test.dir}}
			err := controller.ensureSpaceHostEligible(context.Background(), actor)
			if (err != nil) != test.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestSpaceStateTransitions(t *testing.T) {
	allowed := [][2]string{{"scheduled", "live"}, {"scheduled", "cancelled"}, {"live", "ended"}}
	for _, transition := range allowed {
		if !spaceTransitionAllowed(transition[0], transition[1]) {
			t.Errorf("expected %s -> %s", transition[0], transition[1])
		}
	}
	for _, transition := range [][2]string{{"ended", "live"}, {"cancelled", "live"}, {"live", "cancelled"}, {"ended", "cancelled"}, {"scheduled", "ended"}} {
		if spaceTransitionAllowed(transition[0], transition[1]) {
			t.Errorf("unexpected %s -> %s", transition[0], transition[1])
		}
	}
}
