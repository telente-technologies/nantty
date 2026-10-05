package types

import (
	"bytes"
	"encoding/json"
)

type Nullable[Value any] struct {
	Present bool
	Value   *Value
}

func (field *Nullable[Value]) UnmarshalJSON(data []byte) error {
	field.Present = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		field.Value = nil
		return nil
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var decoded Value
	if err := decoder.Decode(&decoded); err != nil {
		return err
	}
	field.Value = &decoded
	return nil
}

func (field Nullable[Value]) MarshalJSON() ([]byte, error) {
	if field.Value == nil {
		return []byte("null"), nil
	}
	return json.Marshal(field.Value)
}

func (field Nullable[Value]) IsZero() bool { return !field.Present }

func (field Nullable[Value]) Resolve(current *Value) *Value {
	if !field.Present {
		return current
	}
	return field.Value
}
