package services

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/predicate"
)

func adcampaignIDIn(ids []uuid.UUID) predicate.AdCampaign { return adcampaign.IDIn(ids...) }
