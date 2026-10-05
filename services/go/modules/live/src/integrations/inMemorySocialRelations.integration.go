package integrations

import (
	"context"
	"sort"
	"sync"

	"github.com/google/uuid"

	"zudomart/modules/live/src/interfaces"
)

type InMemorySocialRelations struct {
	mutex       sync.Mutex
	blocks      map[[2]uuid.UUID]bool
	follows     map[[2]uuid.UUID]bool
	subscribers map[[2]uuid.UUID]bool
	privacy     map[uuid.UUID]interfaces.MentionPrivacy
	alertOptOut map[uuid.UUID]bool
}

func NewInMemorySocialRelations() *InMemorySocialRelations {
	return &InMemorySocialRelations{
		blocks: map[[2]uuid.UUID]bool{}, follows: map[[2]uuid.UUID]bool{}, subscribers: map[[2]uuid.UUID]bool{}, privacy: map[uuid.UUID]interfaces.MentionPrivacy{}, alertOptOut: map[uuid.UUID]bool{},
	}
}

func (relations *InMemorySocialRelations) Block(blocker, blocked uuid.UUID) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	relations.blocks[[2]uuid.UUID{blocker, blocked}] = true
}

func (relations *InMemorySocialRelations) Follow(follower, followee uuid.UUID) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	relations.follows[[2]uuid.UUID{follower, followee}] = true
}

func (relations *InMemorySocialRelations) Subscribe(subscriber, creator uuid.UUID) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	relations.subscribers[[2]uuid.UUID{subscriber, creator}] = true
}

func (relations *InMemorySocialRelations) SetMentionPrivacy(userId uuid.UUID, setting interfaces.MentionPrivacy) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	relations.privacy[userId] = setting
}

func (relations *InMemorySocialRelations) BlockedEitherWay(_ context.Context, userId uuid.UUID, others []uuid.UUID) (map[uuid.UUID]bool, error) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	blocked := map[uuid.UUID]bool{}
	for _, other := range others {
		if relations.blocks[[2]uuid.UUID{userId, other}] || relations.blocks[[2]uuid.UUID{other, userId}] {
			blocked[other] = true
		}
	}
	return blocked, nil
}

func (relations *InMemorySocialRelations) IsFollowing(_ context.Context, followerId, followeeId uuid.UUID) (bool, error) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	return relations.follows[[2]uuid.UUID{followerId, followeeId}], nil
}

func (relations *InMemorySocialRelations) FollowCounts(_ context.Context, userId uuid.UUID) (int, int, error) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	followers, following := 0, 0
	for pair := range relations.follows {
		if pair[1] == userId {
			followers++
		}
		if pair[0] == userId {
			following++
		}
	}
	return followers, following, nil
}

func (relations *InMemorySocialRelations) IsActiveSubscriber(_ context.Context, subscriberId, creatorId uuid.UUID) (bool, error) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	return relations.subscribers[[2]uuid.UUID{subscriberId, creatorId}], nil
}

func (relations *InMemorySocialRelations) MentionPrivacyOf(_ context.Context, userIds []uuid.UUID) (map[uuid.UUID]interfaces.MentionPrivacy, error) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	result := map[uuid.UUID]interfaces.MentionPrivacy{}
	for _, userId := range userIds {
		if setting, known := relations.privacy[userId]; known {
			result[userId] = setting
		}
	}
	return result, nil
}

func (relations *InMemorySocialRelations) OptOutOfLiveAlerts(userId uuid.UUID) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	relations.alertOptOut[userId] = true
}

func (relations *InMemorySocialRelations) ListLiveAlertRecipients(_ context.Context, hostId uuid.UUID, limit int) ([]uuid.UUID, bool, error) {
	relations.mutex.Lock()
	defer relations.mutex.Unlock()
	var recipients []uuid.UUID
	for pair := range relations.follows {
		follower := pair[0]
		if pair[1] != hostId || relations.alertOptOut[follower] || relations.blocks[[2]uuid.UUID{follower, hostId}] || relations.blocks[[2]uuid.UUID{hostId, follower}] {
			continue
		}
		recipients = append(recipients, follower)
	}
	sort.Slice(recipients, func(left, right int) bool { return recipients[left].String() < recipients[right].String() })
	if len(recipients) > limit {
		return recipients[:limit], true, nil
	}
	return recipients, false, nil
}
