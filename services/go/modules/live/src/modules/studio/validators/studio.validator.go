package validators

import (
	"net/http"

	"zudomart/modules/live/src/interfaces"
	"zudomart/modules/live/src/modules/studio/dtos"
	"zudomart/modules/live/src/utils"
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
