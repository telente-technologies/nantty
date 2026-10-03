package jsonencoding

import "encoding/json"

func MustMarshalJson(value any) json.RawMessage {
	encoded, err := json.Marshal(value)
	if err != nil {
		return json.RawMessage(`null`)
	}
	return encoded
}
