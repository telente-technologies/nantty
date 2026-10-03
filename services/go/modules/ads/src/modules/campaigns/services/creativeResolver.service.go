package services

import (
	"strings"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/types"
)

func ResolveCreative(input types.CreativeInput, account *ent.AdAccount, mediaBaseUrl string) types.StoredCreative {
	media := make([]types.CreativeMedia, 0, len(input.MediaIds))
	for _, mediaId := range input.MediaIds {
		media = append(media, types.CreativeMedia{Id: mediaId, Kind: "image", Url: strings.TrimRight(mediaBaseUrl, "/") + "/" + mediaId})
	}
	handle := strings.ToLower(strings.ReplaceAll(account.Name, " ", ""))
	resolved := types.Creative{
		Format: input.Format, Source: input.Source, Media: media, Headline: strings.TrimSpace(input.Headline), PrimaryText: input.PrimaryText, CallToAction: input.CallToAction,
		Destination: input.Destination, Identity: types.CreativeIdentity{Name: account.Name, Handle: handle, VerifiedBusiness: account.VerifiedBusiness},
	}
	return types.StoredCreative{Input: input, Resolved: resolved}
}
