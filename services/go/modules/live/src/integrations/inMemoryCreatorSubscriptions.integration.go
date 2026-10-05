package integrations

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

type inMemorySubscription struct {
	subscriber, creator uuid.UUID
	startedAt           time.Time
}

type InMemoryCreatorSubscriptions struct {
	mutex         sync.Mutex
	subscriptions []inMemorySubscription
}

func (subscriptions *InMemoryCreatorSubscriptions) Subscribe(subscriber, creator uuid.UUID, startedAt time.Time) {
	subscriptions.mutex.Lock()
	defer subscriptions.mutex.Unlock()
	subscriptions.subscriptions = append(subscriptions.subscriptions, inMemorySubscription{subscriber: subscriber, creator: creator, startedAt: startedAt})
}

func (subscriptions *InMemoryCreatorSubscriptions) IsActiveSubscriber(_ context.Context, subscriberId, creatorId uuid.UUID) (bool, error) {
	subscriptions.mutex.Lock()
	defer subscriptions.mutex.Unlock()
	for _, subscription := range subscriptions.subscriptions {
		if subscription.subscriber == subscriberId && subscription.creator == creatorId {
			return true, nil
		}
	}
	return false, nil
}

func (subscriptions *InMemoryCreatorSubscriptions) CountNewSubscribers(_ context.Context, creatorId uuid.UUID, from, to time.Time) (int, error) {
	subscriptions.mutex.Lock()
	defer subscriptions.mutex.Unlock()
	count := 0
	for _, subscription := range subscriptions.subscriptions {
		if subscription.creator == creatorId && !subscription.startedAt.Before(from) && subscription.startedAt.Before(to) {
			count++
		}
	}
	return count, nil
}
