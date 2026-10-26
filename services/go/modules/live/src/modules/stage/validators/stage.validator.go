package validators

import (
	"nantty/modules/live/src/modules/stage/dtos"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

func ValidateInviteGuestRequest(body dtos.InviteGuestRequest) error {
	var collected utils.Issues
	utils.ParseIdentifiers("userId", []string{body.UserId}, &collected)
	return collected.AsError()
}

func ValidateMuteRequest(body dtos.MuteRequest) error {
	if body.Audio == nil && body.Video == nil {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "audio", Message: "send audio and/or video"}})
	}
	return nil
}

func ValidateConnectionRequest(body dtos.ConnectionRequest) error {
	if body.Connected == nil {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "connected", Message: "is required"}})
	}
	return nil
}
