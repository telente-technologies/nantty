package decideadforslot

import (
	"nantty/modules/ads/src/modules/decision/dtos"
	"nantty/modules/ads/src/types"
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
