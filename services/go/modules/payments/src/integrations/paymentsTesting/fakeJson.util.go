package paymentstesting

import (
	"encoding/json"
	"net/http"
)

func writeFakeJson(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}

func text(value any) string {
	if typed, ok := value.(string); ok {
		return typed
	}
	if typed, ok := value.(json.Number); ok {
		return typed.String()
	}
	return ""
}
