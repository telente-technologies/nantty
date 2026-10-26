package services

import (
	"strings"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/types"
)

func ResolveCreative(input types.CreativeInput, account *ent.AdAccount, mediaBaseUrl string) types.StoredCreative {
	media := make([]types.CreativeMedia, 0, len(input.MediaIds))
	for _, mediaId := range input.MediaIds {
		media = append(media, types.CreativeMedia{Id: mediaId, Kind: "image", Url: strings.TrimRight(mediaBaseUrl, "/") + "/" + mediaId})
	}
	cards := make([]types.CreativeCard, 0, len(input.Cards))
	for _, card := range input.Cards {
		cards = append(cards, types.CreativeCard{
			Media:    types.CreativeMedia{Id: card.MediaId, Kind: "image", Url: strings.TrimRight(mediaBaseUrl, "/") + "/" + card.MediaId},
			Headline: strings.TrimSpace(card.Headline), Description: card.Description, CallToAction: card.CallToAction, Destination: card.Destination,
		})
	}
	var app *types.CreativeApp
	if input.App != nil {
		copied := *input.App
		copied.AppName = strings.TrimSpace(copied.AppName)
		if copied.IconMediaId != "" {
			copied.IconUrl = strings.TrimRight(mediaBaseUrl, "/") + "/" + copied.IconMediaId
		}
		app = &copied
	}
	creativeType := input.Type
	if creativeType == "" {
		creativeType = "single"
	}
	handle := strings.ToLower(strings.ReplaceAll(account.Name, " ", ""))
	resolved := types.Creative{
		Format: input.Format, Type: creativeType, MediaClickable: input.MediaClickable, Cards: cards, App: app, Source: input.Source, Media: media, Headline: strings.TrimSpace(input.Headline), PrimaryText: input.PrimaryText, CallToAction: input.CallToAction,
		Destination: input.Destination, Identity: types.CreativeIdentity{Name: account.Name, Handle: handle, VerifiedBusiness: account.VerifiedBusiness},
	}
	return types.StoredCreative{Input: input, Resolved: resolved}
}
