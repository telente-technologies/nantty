package services

import "zudomart/modules/subscriptions/src/generated/ent/subscription"

func IsWebCheckoutChannel(channel subscription.Channel) bool {
	return channel == subscription.ChannelWebCheckout
}
