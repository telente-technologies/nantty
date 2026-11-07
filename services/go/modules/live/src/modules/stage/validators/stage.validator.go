package validators

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"nantty/modules/live/src/modules/stage/dtos"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

func ValidateInviteGuestRequest(body dtos.InviteGuestRequest) error {
	var collected utils.Issues
	utils.ParseIdentifiers("userId", []string{body.UserId}, &collected)
	if body.Role != "" && body.Role != "speaker" && body.Role != "cohost" {
		collected.Add("role", "must be speaker or cohost")
	}
	title := strings.TrimSpace(body.Title)
	if utf8.RuneCountInString(title) > 32 || strings.IndexFunc(title, unicode.IsControl) >= 0 {
		collected.Add("title", "must be at most 32 characters and contain no control characters")
	}
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
