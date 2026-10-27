package jwtauth

import "time"

const (
	RealtimeTokenAudience          = "nantty-realtime"
	RealtimeTokenScope             = "realtime"
	RealtimeTokenDefaultTimeToLive = 90 * time.Second
	RealtimeTokenMinimumTimeToLive = 30 * time.Second
	RealtimeTokenMaximumTimeToLive = 120 * time.Second
)
