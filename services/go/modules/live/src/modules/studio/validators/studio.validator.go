package validators

import (
	"net/http"

	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/modules/studio/dtos"
	"nantty/modules/live/src/utils"
)

func ReadIngressProtocol(request *http.Request) (interfaces.IngressProtocol, error) {
	switch raw := request.URL.Query().Get("protocol"); raw {
	case "", "rtmp":
		return interfaces.IngressRtmp, nil
	case "whip":
		return interfaces.IngressWhip, nil
	}
	var collected utils.Issues
	collected.Add("protocol", "must be rtmp or whip")
	return "", collected.AsError()
}

func ValidateRecordingSettingRequest(body dtos.RecordingSettingRequest) error {
	var collected utils.Issues
	if body.Enabled == nil {
		collected.Add("enabled", "is required")
	}
	return collected.AsError()
}

func ValidateHostDefaultsRequest(body dtos.HostDefaultsRequest) error {
	var collected utils.Issues
	if body.CommentAudience != nil && !utils.IsCommentAudience(*body.CommentAudience) {
		collected.Add("commentAudience", "must be everyone, followers or subscribers")
	}
	if body.SlowModeSeconds != nil && (*body.SlowModeSeconds < 0 || *body.SlowModeSeconds > 300) {
		collected.Add("slowModeSeconds", "must be between 0 and 300")
	}
	if body.ModeratorIds != nil {
		utils.ParseIdentifiers("moderatorIds", *body.ModeratorIds, &collected)
	}
	return collected.AsError()
}
