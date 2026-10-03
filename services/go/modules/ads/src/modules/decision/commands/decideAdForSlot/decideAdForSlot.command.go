package decideadforslot

import (
	"zudomart/modules/ads/src/modules/decision/dtos"
	"zudomart/modules/ads/src/types"
)

type Command struct {
	UserId        string
	SessionId     string
	Slot          dtos.SlotRequest
	Viewer        types.Viewer
	TrustedSignal *types.ContentSignal
}

type Result struct {
	Ad             *dtos.DecidedAd
	DeclinedReason string
}
