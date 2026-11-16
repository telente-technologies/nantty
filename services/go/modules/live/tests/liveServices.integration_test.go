package live_test

import "nantty/modules/live/src/services"

func newServiceFor(harness *liveHarness) *services.LiveService {
	return services.NewLiveService(harness.module.Container)
}
