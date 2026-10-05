package validators

import (
	"zudomart/modules/admin/src/modules/platformSettings/dtos"
	"zudomart/modules/admin/src/utils/validation"
)

func ValidateUpdateSettingRequest(request dtos.UpdateSettingRequest) error {
	collector := &validation.Collector{}
	collector.RequireTrue("value", len(request.EffectiveValue()) > 0, "is required")
	collector.RequireTrue("expectedVersion", request.ExpectedVersion > 0, "must be a positive integer")
	collector.RequireLength("reason", request.Reason, 5, 500)
	return collector.Result()
}

func ValidateRestoreSettingRequest(request dtos.RestoreSettingRequest) error {
	collector := &validation.Collector{}
	collector.RequireTrue("expectedVersion", request.ExpectedVersion > 0, "must be a positive integer")
	collector.RequireLength("reason", request.Reason, 5, 500)
	return collector.Result()
}
