package utils

import "encoding/json"

type NullableString struct {
	Present bool
	Value   *string
}

func (nullable *NullableString) UnmarshalJSON(raw []byte) error {
	nullable.Present = true
	if string(raw) == "null" {
		nullable.Value = nil
		return nil
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	nullable.Value = &value
	return nil
}
