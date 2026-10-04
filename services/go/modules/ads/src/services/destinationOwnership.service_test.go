package services

import (
	"context"
	"errors"
	"testing"

	"zudomart/modules/ads/src/interfaces"
	"zudomart/modules/ads/src/types"
	"zudomart/platform/httpserver"
)

type fakeOwnership struct {
	owned map[string]bool
	calls int
	err   error
}

func (fake *fakeOwnership) Owns(_ context.Context, query interfaces.OwnershipQuery) (bool, error) {
	fake.calls++
	return fake.owned[query.Kind+":"+query.TargetId], fake.err
}

func sid(value string) *string { return &value }

func creativeWith(source types.CreativeSource, destination types.CreativeDestination, cards ...types.CreativeCardInput) types.CreativeInput {
	return types.CreativeInput{Source: source, Destination: destination, Cards: cards}
}

func TestOwnershipRejectsForeignTargets(t *testing.T) {
	fake := &fakeOwnership{owned: map[string]bool{"post:mine": true}}
	input := creativeWith(types.CreativeSource{Type: "post", Id: "mine"}, types.CreativeDestination{Type: "product", TargetId: sid("theirs")})
	err := VerifyCreativeOwnership(context.Background(), fake, AdvertiserIdentity{OwnerUserId: "u1"}, input, "creative")
	var validation *httpserver.ApiError
	if err == nil || !errors.As(err, &validation) {
		t.Fatalf("foreign product must be rejected, got %v", err)
	}
	if got := CollectOwnershipRefs(input, "creative"); len(got) != 2 || got[1].Path != "creative.destination.targetId" {
		t.Fatalf("unexpected refs %+v", got)
	}
}

func TestOwnershipAllowsOwnTargetsAndChecksCards(t *testing.T) {
	fake := &fakeOwnership{owned: map[string]bool{"store:s1": true, "profile:u1": true}}
	card := types.CreativeCardInput{Destination: types.CreativeDestination{Type: "store", TargetId: sid("s1")}}
	input := creativeWith(types.CreativeSource{Type: "upload"}, types.CreativeDestination{Type: "profile", TargetId: sid("u1")}, card, card)
	if err := VerifyCreativeOwnership(context.Background(), fake, AdvertiserIdentity{OwnerUserId: "u1", StoreId: "s1"}, input, "creative"); err != nil {
		t.Fatalf("owned targets must pass: %v", err)
	}
	if fake.calls != 2 {
		t.Fatalf("repeated targets must be checked once, calls=%d", fake.calls)
	}
	card.Destination.TargetId = sid("other")
	bad := creativeWith(types.CreativeSource{Type: "upload"}, types.CreativeDestination{Type: "url", Url: sid("https://a.example")}, card)
	if err := VerifyCreativeOwnership(context.Background(), fake, AdvertiserIdentity{}, bad, "ads.0.creative"); err == nil {
		t.Fatal("foreign card store must be rejected")
	}
}

func TestOwnershipIgnoresExternalUrlsAndPropagatesUpstreamErrors(t *testing.T) {
	fake := &fakeOwnership{}
	external := creativeWith(types.CreativeSource{Type: "upload"}, types.CreativeDestination{Type: "url", Url: sid("https://a.example")})
	if err := VerifyCreativeOwnership(context.Background(), fake, AdvertiserIdentity{}, external, "creative"); err != nil || fake.calls != 0 {
		t.Fatalf("external urls need no ownership lookup: %v calls=%d", err, fake.calls)
	}
	failing := &fakeOwnership{err: errors.New("down")}
	input := creativeWith(types.CreativeSource{Type: "post", Id: "p"}, types.CreativeDestination{Type: "post", TargetId: sid("p")})
	if err := VerifyCreativeOwnership(context.Background(), failing, AdvertiserIdentity{}, input, "creative"); err == nil || err.Error() != "down" {
		t.Fatalf("upstream failure must fail closed, got %v", err)
	}
}
