package middlewares

import (
	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/services"
)

func StepUpGate(deployed *container.Container) services.AdsStepUpGate {
	return services.AdsStepUpGate{Pricing: deployed.Pricing, Verifier: deployed.AccessVerifier, StepUps: deployed.StepUps}
}
