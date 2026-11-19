package integrations

import (
	"encoding/json"
	"errors"
	"io"
)

const maximumSmileIdPostResponseBytes = 1 << 20

func decodeSmileIdPostResponse(body io.Reader, destination any) error {
	responseBody, err := io.ReadAll(io.LimitReader(body, maximumSmileIdPostResponseBytes+1))
	if err != nil {
		return err
	}
	if len(responseBody) > maximumSmileIdPostResponseBytes {
		return errors.New("response exceeded the maximum size")
	}
	return json.Unmarshal(responseBody, destination)
}
