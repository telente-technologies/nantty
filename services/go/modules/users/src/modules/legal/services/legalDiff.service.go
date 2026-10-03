package services

import (
	"strings"
)

const maximumChangeLines = 12

func GenerateWhatChanged(previous, next string) []string {
	previousLines := lineSet(previous)
	nextLines := lineSet(next)
	changes := []string{}
	for _, line := range strings.Split(next, "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" && !previousLines[trimmed] && len(changes) < maximumChangeLines {
			changes = append(changes, "Added: "+clip(trimmed))
		}
	}
	for _, line := range strings.Split(previous, "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" && !nextLines[trimmed] && len(changes) < maximumChangeLines {
			changes = append(changes, "Removed: "+clip(trimmed))
		}
	}
	return changes
}

func lineSet(text string) map[string]bool {
	set := map[string]bool{}
	for _, line := range strings.Split(text, "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			set[trimmed] = true
		}
	}
	return set
}

func clip(line string) string {
	runes := []rune(strings.TrimLeft(line, "#-* "))
	if len(runes) > 140 {
		return string(runes[:140]) + "..."
	}
	return string(runes)
}
