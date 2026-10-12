package services

import (
	"hash/fnv"
	"strconv"
	"strings"
	"time"
)

const FullAdLoadPercent = 100

type AdLoadSlotKey struct {
	UserId           string
	SessionId        string
	SlotKind         string
	ContentId        string
	SlotIndex        *int
	SlotsSinceLastAd *int
	Neighbours       []string
	At               time.Time
}

func AdLoadRoll(key AdLoadSlotKey) int {
	parts := []string{key.UserId, key.SessionId, key.SlotKind, key.ContentId, strings.Join(key.Neighbours, ",")}
	if key.SlotIndex != nil {
		parts = append(parts, "i"+strconv.Itoa(*key.SlotIndex))
	} else {
		parts = append(parts, "t"+strconv.FormatInt(key.At.UnixNano(), 10))
	}
	if key.SlotsSinceLastAd != nil {
		parts = append(parts, "s"+strconv.Itoa(*key.SlotsSinceLastAd))
	}
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(strings.Join(parts, "|")))
	return int(hash.Sum64() % FullAdLoadPercent)
}

func AdLoadDeclineReason(percent, roll int) string {
	switch {
	case percent <= 0:
		return "plan_ad_free"
	case percent >= FullAdLoadPercent:
		return ""
	case roll >= percent:
		return "plan_ad_load"
	}
	return ""
}
