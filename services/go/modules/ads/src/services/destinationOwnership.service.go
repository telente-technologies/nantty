package services

import (
	"context"
	"fmt"

	"zudomart/modules/ads/src/interfaces"
	"zudomart/modules/ads/src/types"
	"zudomart/platform/httpserver"
)

const ownershipMessage = "You can only promote content you own or manage."

type OwnershipRef struct {
	Path     string
	Kind     string
	TargetId string
}

type AdvertiserIdentity struct {
	OwnerUserId string
	StoreId     string
}

func internalTarget(destination types.CreativeDestination) (string, bool) {
	switch destination.Type {
	case "post", "product", "store", "profile":
		if destination.TargetId != nil && *destination.TargetId != "" {
			return *destination.TargetId, true
		}
	}
	return "", false
}

func CollectOwnershipRefs(input types.CreativeInput, path string) []OwnershipRef {
	refs := []OwnershipRef{}
	switch input.Source.Type {
	case "post", "clip", "product", "store":
		if input.Source.Id != "" {
			refs = append(refs, OwnershipRef{Path: path + ".source", Kind: input.Source.Type, TargetId: input.Source.Id})
		}
	}
	if id, ok := internalTarget(input.Destination); ok {
		refs = append(refs, OwnershipRef{Path: path + ".destination.targetId", Kind: input.Destination.Type, TargetId: id})
	}
	for index, card := range input.Cards {
		if id, ok := internalTarget(card.Destination); ok {
			refs = append(refs, OwnershipRef{Path: fmt.Sprintf("%s.cards.%d.destination.targetId", path, index), Kind: card.Destination.Type, TargetId: id})
		}
	}
	return refs
}

func VerifyOwnership(ctx context.Context, checker interfaces.DestinationOwnership, advertiser AdvertiserIdentity, refs []OwnershipRef) error {
	var issues []httpserver.ValidationIssue
	checked := map[string]bool{}
	for _, ref := range refs {
		key := ref.Kind + ":" + ref.TargetId
		owned, seen := checked[key]
		if !seen {
			result, err := checker.Owns(ctx, interfaces.OwnershipQuery{Kind: ref.Kind, TargetId: ref.TargetId, OwnerUserId: advertiser.OwnerUserId, StoreId: advertiser.StoreId})
			if err != nil {
				return err
			}
			owned = result
			checked[key] = owned
		}
		if !owned {
			issues = append(issues, httpserver.ValidationIssue{Path: ref.Path, Message: ownershipMessage})
		}
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func VerifyCreativeOwnership(ctx context.Context, checker interfaces.DestinationOwnership, advertiser AdvertiserIdentity, input types.CreativeInput, path string) error {
	return VerifyOwnership(ctx, checker, advertiser, CollectOwnershipRefs(input, path))
}
