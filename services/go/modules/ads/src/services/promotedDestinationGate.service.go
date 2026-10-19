package services

import (
	"context"
	"log/slog"

	"zudomart/modules/ads/src/interfaces"
	"zudomart/modules/ads/src/types"
)

type promotedRef struct{ kind, id string }

func isPromotableEntityKind(kind string) bool { return kind == "store" || kind == "profile" }

func PromotedEntityOf(creative types.Creative) (string, string, bool) {
	if isPromotableEntityKind(creative.Source.Type) && creative.Source.Id != "" {
		return creative.Source.Type, creative.Source.Id, true
	}
	if isPromotableEntityKind(creative.Destination.Type) && creative.Destination.TargetId != nil && *creative.Destination.TargetId != "" {
		return creative.Destination.Type, *creative.Destination.TargetId, true
	}
	return "", "", false
}

func promotedRefsOf(creative types.Creative) []promotedRef {
	refs := []promotedRef{}
	if kind, id, ok := PromotedEntityOf(creative); ok {
		refs = append(refs, promotedRef{kind, id})
	}
	destinations := []types.CreativeDestination{creative.Destination}
	for _, card := range creative.Cards {
		destinations = append(destinations, card.Destination)
	}
	for _, destination := range destinations {
		if isPromotableEntityKind(destination.Type) && destination.TargetId != nil && *destination.TargetId != "" {
			refs = append(refs, promotedRef{destination.Type, *destination.TargetId})
		}
	}
	return refs
}

func lookupPromoted(ctx context.Context, directory interfaces.PromotedDestinationDirectory, candidates []types.CandidateAd) (map[promotedRef]interfaces.PromotedDestination, error) {
	idsByKind := map[string][]string{}
	for _, candidate := range candidates {
		for _, ref := range promotedRefsOf(candidate.Creative) {
			idsByKind[ref.kind] = append(idsByKind[ref.kind], ref.id)
		}
	}
	found := map[promotedRef]interfaces.PromotedDestination{}
	for kind, ids := range idsByKind {
		byId, err := directory.LookupDestinations(ctx, kind, ids)
		if err != nil {
			return nil, err
		}
		for id, destination := range byId {
			found[promotedRef{kind, id}] = destination
		}
	}
	return found, nil
}

func ApplyPromotedDestinations(ctx context.Context, directory interfaces.PromotedDestinationDirectory, logger *slog.Logger, candidates []types.CandidateAd) []types.CandidateAd {
	if directory == nil {
		return candidates
	}
	found, err := lookupPromoted(ctx, directory, candidates)
	if err != nil {
		if logger != nil {
			logger.WarnContext(ctx, "promoted store and profile status unavailable; serving without the check", "error", err)
		}
		return candidates
	}
	kept := make([]types.CandidateAd, 0, len(candidates))
	for _, candidate := range candidates {
		if !allPromotedAvailable(candidate.Creative, found) {
			continue
		}
		if kind, id, ok := PromotedEntityOf(candidate.Creative); ok {
			attachPromoted(&candidate.Creative, found[promotedRef{kind, id}])
		}
		kept = append(kept, candidate)
	}
	return kept
}

func allPromotedAvailable(creative types.Creative, found map[promotedRef]interfaces.PromotedDestination) bool {
	for _, ref := range promotedRefsOf(creative) {
		if destination, exists := found[ref]; !exists || !destination.Available {
			return false
		}
	}
	return true
}

func attachPromoted(creative *types.Creative, destination interfaces.PromotedDestination) {
	creative.Promoted = &types.CreativePromoted{
		Kind: destination.Kind, Id: destination.Id, Name: destination.Name, Handle: destination.Handle, AvatarUrl: destination.AvatarUrl,
		Verified: destination.Verified, CheckmarkColor: destination.CheckmarkColor, Private: destination.Private,
	}
	if isPromotableEntityKind(creative.Source.Type) {
		creative.Identity = types.CreativeIdentity{Name: destination.Name, Handle: destination.Handle, AvatarUrl: destination.AvatarUrl, VerifiedBusiness: destination.Verified}
	}
}
