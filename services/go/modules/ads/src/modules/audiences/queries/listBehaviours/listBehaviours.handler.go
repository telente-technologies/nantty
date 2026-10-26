package listbehaviours

import "nantty/modules/ads/src/modules/audiences/services"

type Handler struct{}

func (Handler) Execute(Query) []services.Behaviour {
	return services.Behaviours
}
