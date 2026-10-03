package services

import (
	"slices"

	"zudomart/modules/orders/src/enums"
)

var allowedTransitions = map[string][]string{
	enums.StatusPending:    {enums.StatusNew, enums.StatusCancelled},
	enums.StatusNew:        {enums.StatusProcessing, enums.StatusShipped, enums.StatusCancelled, enums.StatusRefunded, enums.StatusDisputed},
	enums.StatusProcessing: {enums.StatusReady, enums.StatusShipped, enums.StatusCancelled, enums.StatusRefunded, enums.StatusDisputed},
	enums.StatusReady:      {enums.StatusProcessing, enums.StatusShipped, enums.StatusCancelled, enums.StatusRefunded, enums.StatusDisputed},
	enums.StatusShipped:    {enums.StatusDelivered, enums.StatusRefunded, enums.StatusDisputed},
	enums.StatusDelivered:  {enums.StatusCompleted, enums.StatusReturned, enums.StatusRefunded, enums.StatusDisputed},
	enums.StatusCompleted:  {enums.StatusReturned, enums.StatusRefunded, enums.StatusDisputed},
	enums.StatusReturned:   {enums.StatusRefunded},
	enums.StatusDisputed:   {enums.StatusNew, enums.StatusProcessing, enums.StatusReady, enums.StatusShipped, enums.StatusDelivered, enums.StatusCompleted, enums.StatusRefunded},
}

var transitionsBySellerOrBuyer = map[string][]string{
	enums.ActorSeller: {enums.StatusProcessing, enums.StatusReady, enums.StatusShipped, enums.StatusDelivered, enums.StatusCancelled, enums.StatusRefunded},
	enums.ActorBuyer:  {enums.StatusCancelled},
}

func CanTransition(from, to string) bool { return slices.Contains(allowedTransitions[from], to) }

func ActorMayMoveTo(actorKind, to string) bool {
	if actorKind == enums.ActorSystem {
		return true
	}
	return slices.Contains(transitionsBySellerOrBuyer[actorKind], to)
}

func IsTerminalStatus(status string) bool {
	return status == enums.StatusCancelled || status == enums.StatusRefunded
}

func DeliveryStatusFor(status, current string) string {
	switch status {
	case enums.StatusPending, enums.StatusNew:
		return "pending"
	case enums.StatusProcessing:
		return "preparing"
	case enums.StatusReady:
		return "ready_for_pickup"
	case enums.StatusShipped:
		if current == "failed" {
			return "failed"
		}
		return "in_transit"
	case enums.StatusDelivered, enums.StatusCompleted:
		return "delivered"
	case enums.StatusCancelled, enums.StatusRefunded:
		return "cancelled"
	case enums.StatusReturned:
		return "returned"
	}
	return current
}

func BuyerStatusFor(status string) string {
	switch status {
	case enums.StatusPending:
		return "pending"
	case enums.StatusNew, enums.StatusProcessing, enums.StatusReady:
		return "paid"
	case enums.StatusShipped, enums.StatusDelivered, enums.StatusCompleted, enums.StatusDisputed, enums.StatusCancelled:
		return status
	}
	return "cancelled"
}

func TimelineKindFor(status string) string {
	switch status {
	case enums.StatusNew:
		return "paid"
	case enums.StatusProcessing:
		return "processing"
	}
	return status
}
