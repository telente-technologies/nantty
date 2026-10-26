package services

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/predicate"
)

func adcampaignIDIn(ids []uuid.UUID) predicate.AdCampaign { return adcampaign.IDIn(ids...) }
