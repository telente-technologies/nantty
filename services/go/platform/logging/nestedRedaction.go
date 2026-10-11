package logging

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"
)

const maximumRedactionDepth = 8

func redactNestedValue(value any) (any, bool) {
	if !isStructuredValue(value) {
		return value, false
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return value, false
	}
	var decoded any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		return value, false
	}
	redacted, changed := redactDecoded(decoded, 0)
	return redacted, changed
}

func isStructuredValue(value any) bool {
	switch value.(type) {
	case nil, error, fmt.Stringer, slog.LogValuer, json.Marshaler:
		return false
	}
	kind := reflect.ValueOf(value).Kind()
	if kind == reflect.Pointer {
		kind = reflect.ValueOf(value).Elem().Kind()
	}
	return kind == reflect.Struct || kind == reflect.Map || kind == reflect.Slice
}

func redactDecoded(value any, depth int) (any, bool) {
	if depth > maximumRedactionDepth {
		return value, false
	}
	changed := false
	switch typed := value.(type) {
	case map[string]any:
		for key, nested := range typed {
			if IsSensitiveAttributeKey(key) {
				typed[key] = "[REDACTED]"
				changed = true
				continue
			}
			if replaced, nestedChanged := redactDecoded(nested, depth+1); nestedChanged {
				typed[key] = replaced
				changed = true
			}
		}
	case []any:
		for index, nested := range typed {
			if replaced, nestedChanged := redactDecoded(nested, depth+1); nestedChanged {
				typed[index] = replaced
				changed = true
			}
		}
	}
	return value, changed
}
