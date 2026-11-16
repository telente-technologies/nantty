package controllers_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/modules/sessions/controllers"
	"nantty/modules/live/src/types"
)

type fakeSpaceDetailRelations struct {
	blocked    bool
	private    bool
	following  bool
	subscriber bool
}

func (relations fakeSpaceDetailRelations) BlockedEitherWay(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID]bool, error) {
	return map[uuid.UUID]bool{uuid.MustParse("00000000-0000-0000-0000-000000000002"): relations.blocked}, nil
}
func (relations fakeSpaceDetailRelations) IsFollowing(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return relations.following, nil
}
func (relations fakeSpaceDetailRelations) FollowedAmong(_ context.Context, _ uuid.UUID, candidates []uuid.UUID) (map[uuid.UUID]bool, error) {
	followed := make(map[uuid.UUID]bool, len(candidates))
	for _, candidate := range candidates {
		followed[candidate] = relations.following
	}
	return followed, nil
}
func (relations fakeSpaceDetailRelations) IsActiveSubscriber(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return relations.subscriber, nil
}
func (relations fakeSpaceDetailRelations) PrivateAccountsAmong(context.Context, []uuid.UUID) (map[uuid.UUID]bool, error) {
	return map[uuid.UUID]bool{uuid.MustParse("00000000-0000-0000-0000-000000000002"): relations.private}, nil
}

func TestAuthorizeSpaceDetails(t *testing.T) {
	hostID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	viewer := &types.Actor{UserId: uuid.New()}
	tests := []struct {
		name       string
		visibility space.Visibility
		viewer     *types.Actor
		relations  fakeSpaceDetailRelations
		metadata   map[string]any
		wantDenied bool
	}{
		{name: "public anonymous listener", visibility: space.VisibilityPublic},
		{name: "public authenticated listener", visibility: space.VisibilityPublic, viewer: viewer},
		{name: "follower space requires following", visibility: space.VisibilityFollowers, viewer: viewer, wantDenied: true},
		{name: "follower can view follower space", visibility: space.VisibilityFollowers, viewer: viewer, relations: fakeSpaceDetailRelations{following: true}},
		{name: "subscriber space requires subscription", visibility: space.VisibilitySubscribers, viewer: viewer, wantDenied: true},
		{name: "subscriber can view subscriber space", visibility: space.VisibilitySubscribers, viewer: viewer, relations: fakeSpaceDetailRelations{subscriber: true}},
		{name: "private host hidden from anonymous", visibility: space.VisibilityPublic, relations: fakeSpaceDetailRelations{private: true}, wantDenied: true},
		{name: "private host hidden from non-follower", visibility: space.VisibilityPublic, viewer: viewer, relations: fakeSpaceDetailRelations{private: true}, wantDenied: true},
		{name: "private host visible to follower", visibility: space.VisibilityPublic, viewer: viewer, relations: fakeSpaceDetailRelations{private: true, following: true}},
		{name: "invite-only hidden from a non-invited account", visibility: space.VisibilityPublic, viewer: viewer, metadata: map[string]any{"spaceAudiencePolicy": "invite_only", "invitedAccountIds": []string{}}, wantDenied: true},
		{name: "invite-only available to explicitly invited account", visibility: space.VisibilityPublic, viewer: viewer, metadata: map[string]any{"spaceAudiencePolicy": "invite_only", "invitedAccountIds": []string{viewer.UserId.String()}}},
		{name: "blocked relationship hides space", visibility: space.VisibilityPublic, viewer: viewer, relations: fakeSpaceDetailRelations{blocked: true}, wantDenied: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := controllers.AuthorizeSpaceDetails(context.Background(), &ent.Space{HostID: hostID, Visibility: test.visibility, ModerationVisibility: "visible", Metadata: test.metadata}, test.viewer, test.relations)
			if (err != nil) != test.wantDenied {
				t.Fatalf("error = %v, wantDenied %v", err, test.wantDenied)
			}
		})
	}
}
