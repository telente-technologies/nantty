package integrations

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
)

func (client *SmileIdClient) postV3Multipart(ctx context.Context, path string, fields map[string]string, token string, destination any) error {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for name, value := range fields {
		if err := writeSmileMultipartField(writer, name, value); err != nil {
			return err
		}
	}
	if err := writer.Close(); err != nil {
		return err
	}
	baseUrl, err := smileIdApiOrigin(client.BaseUrl)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, baseUrl+path, &body)
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	if path == "/v3/token" {
		request.Header.Set("smileid-partner-id", client.PartnerId)
		request.Header.Set("smileid-api-key", client.ApiKey)
	} else {
		request.Header.Set("SmileID-Partner-ID", client.PartnerId)
		request.Header.Set("SmileID-Token", token)
	}
	response, err := client.do(request)
	if err != nil {
		return fmt.Errorf("smile id: request %s failed: %w", path, err)
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		return fmt.Errorf("smile id: %s returned status %s", path, strconv.Itoa(response.StatusCode))
	}
	if err := decodeSmileIdPostResponse(response.Body, destination); err != nil {
		return fmt.Errorf("smile id: invalid response from %s: %w", path, err)
	}
	return nil
}

func writeSmileMultipartField(writer *multipart.Writer, name, value string) error {
	if name != "id_types" && name != "partner_params" && name != "payload" {
		return writer.WriteField(name, value)
	}
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="`+name+`"`)
	header.Set("Content-Type", "application/json")
	part, err := writer.CreatePart(header)
	if err != nil {
		return err
	}
	_, err = io.WriteString(part, value)
	return err
}
