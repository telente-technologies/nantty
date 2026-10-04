package decideadforslot

import (
	"strings"

	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

// buildClickLinks signs one redirect link per clickable surface so the client never handles a raw destination for external or store clicks.
func (handler Handler) buildClickLinks(creative types.Creative, impressionToken string, claims services.AdTokenClaims) (*types.CreativeClickLinks, error) {
	deployed := handler.Container
	link := func(cardIndex int) (string, error) {
		token, err := deployed.Signer.SignClick(services.ClickClaims{ImpressionToken: impressionToken, ImpressionId: claims.ImpressionId, AdId: claims.AdId, UserId: claims.UserId, CardIndex: cardIndex})
		if err != nil {
			return "", err
		}
		return strings.TrimRight(deployed.Settings.PublicBaseUrl, "/") + "/api/v1/ads/r/" + token, nil
	}
	links := &types.CreativeClickLinks{}
	if len(creative.Cards) > 0 {
		for index := range creative.Cards {
			cardLink, err := link(index)
			if err != nil {
				return nil, err
			}
			links.Cards = append(links.Cards, cardLink)
		}
		return links, nil
	}
	cta, err := link(0)
	if err != nil {
		return nil, err
	}
	links.Cta = cta
	if creative.MediaClickable || creative.Type == "promoted_post" || creative.Type == "app_install" {
		links.Media = cta
	}
	return links, nil
}
