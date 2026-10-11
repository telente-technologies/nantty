package logging

import (
	"io"
	"log/slog"
	"os"
	"strings"
)

var sensitiveAttributeKeyFragments = []string{
	"password", "token", "secret", "authorization", "cookie", "otp", "code", "pin",
	"cardnumber", "cvv", "accountnumber", "bvn", "privatekey",
}

func NewJsonLoggerForService(serviceName, level string) *slog.Logger {
	return NewJsonLoggerWritingTo(os.Stdout, serviceName, level)
}

func NewJsonLoggerWritingTo(writer io.Writer, serviceName, level string) *slog.Logger {
	handler := slog.NewJSONHandler(writer, &slog.HandlerOptions{
		Level:       parseLogLevel(level),
		ReplaceAttr: redactSensitiveAttribute,
	})
	return slog.New(handler).With(slog.String("service", serviceName))
}

func IsSensitiveAttributeKey(key string) bool {
	lowered := strings.ToLower(strings.ReplaceAll(key, "_", ""))
	for _, fragment := range sensitiveAttributeKeyFragments {
		if strings.Contains(lowered, fragment) {
			return true
		}
	}
	return false
}

func redactSensitiveAttribute(_ []string, attribute slog.Attr) slog.Attr {
	if attribute.Key == slog.MessageKey || attribute.Key == slog.LevelKey || attribute.Key == slog.TimeKey {
		return attribute
	}
	if IsSensitiveAttributeKey(attribute.Key) {
		return slog.String(attribute.Key, "[REDACTED]")
	}
	if attribute.Value.Kind() == slog.KindAny {
		if redacted, changed := redactNestedValue(attribute.Value.Any()); changed {
			return slog.Any(attribute.Key, redacted)
		}
	}
	return attribute
}

func parseLogLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
