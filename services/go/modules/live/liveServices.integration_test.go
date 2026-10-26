package live

import "nantty/modules/live/src/services"

func newServiceFor(harness *liveHarness) *services.LiveService {
	return services.NewLiveService(harness.module.Container)
}
