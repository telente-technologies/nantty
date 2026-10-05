package dtos

import "encoding/json"

type NullableList struct {
	Present bool
	Values  []string
}

func (list *NullableList) UnmarshalJSON(raw []byte) error {
	list.Present = true
	if string(raw) == "null" {
		list.Values = nil
		return nil
	}
	values := []string{}
	if err := json.Unmarshal(raw, &values); err != nil {
		return err
	}
	list.Values = values
	return nil
}
