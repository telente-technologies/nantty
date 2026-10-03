package services

import (
	"slices"
	"time"
)

const SlaDuration = 72 * time.Hour

func CanTransition(from, action string) bool {
	switch action {
	case "uphold", "reject":
		return slices.Contains([]string{"open", "needs_info"}, from)
	case "request_info":
		return from == "open"
	}
	return false
}

func AllowedActions(status string) []string {
	allowed := []string{}
	for _, action := range []string{"uphold", "reject", "request-info"} {
		name := action
		if action == "request-info" {
			name = "request_info"
		}
		if CanTransition(status, name) {
			allowed = append(allowed, action)
		}
	}
	return allowed
}

func StrikePolicyForKind(kind string) string {
	if kind == "counterfeit" {
		return "Counterfeit goods"
	}
	return "Trademark infringement"
}
