package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

var smileIdReplayJobIDPattern = regexp.MustCompile(`^job_[0-9a-z]{26}$`)

type SmileIdReplayResult struct {
	Status string
	JobID  string
}

func (client *SmileIdClient) ReplayCallback(ctx context.Context, product, captureAttemptID, jobID string) (SmileIdReplayResult, error) {
	if client == nil || client.Http == nil || !smileIdPartnerIdPattern.MatchString(client.PartnerId) || strings.TrimSpace(client.ApiKey) == "" {
		return SmileIdReplayResult{}, ErrSmileIdNotConfigured
	}
	if product != "document_verification" && product != "enhanced_document_verification" && product != "enhanced_kyc" {
		return SmileIdReplayResult{}, errors.New("smile id: unsupported replay product")
	}
	attemptID, err := uuid.Parse(captureAttemptID)
	if err != nil || attemptID == uuid.Nil || !smileIdReplayJobIDPattern.MatchString(jobID) {
		return SmileIdReplayResult{}, errors.New("smile id: invalid replay correlation")
	}
	var tokenResponse struct {
		Token string `json:"token"`
	}
	if err := client.postV3Multipart(ctx, "/v3/token", map[string]string{
		"product": product,
		"user_id": SmileIdUserIDForCaptureAttempt(attemptID.String()),
	}, "", &tokenResponse); err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: replay token request failed: %w", err)
	}
	if strings.TrimSpace(tokenResponse.Token) == "" {
		return SmileIdReplayResult{}, errors.New("smile id: replay token response was empty")
	}
	origin, err := smileIdApiOrigin(client.BaseUrl)
	if err != nil {
		return SmileIdReplayResult{}, err
	}
	expectedUserID := SmileIdUserIDForCaptureAttempt(attemptID.String())
	statusRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, origin+"/v3/status/"+jobID, nil)
	if err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: build replay status request: %w", err)
	}
	statusRequest.Header.Set("Accept", "application/json")
	statusRequest.Header.Set("SmileID-Partner-ID", client.PartnerId)
	statusRequest.Header.Set("SmileID-Token", tokenResponse.Token)
	statusResponse, err := client.doReadWithRetry(statusRequest)
	if err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: replay status request failed: %w", err)
	}
	statusBody, readErr := io.ReadAll(io.LimitReader(statusResponse.Body, (1<<20)+1))
	_ = statusResponse.Body.Close()
	if readErr != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: read replay status response: %w", readErr)
	}
	if len(statusBody) > 1<<20 {
		return SmileIdReplayResult{}, errors.New("smile id: replay status response exceeded the size limit")
	}
	if statusResponse.StatusCode != http.StatusOK {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: replay status returned status %d", statusResponse.StatusCode)
	}
	var statusResult struct {
		Status    string `json:"status"`
		JobID     string `json:"job_id"`
		UserID    string `json:"user_id"`
		Message   string `json:"message"`
		CreatedAt string `json:"created_at"`
	}
	if err := json.Unmarshal(statusBody, &statusResult); err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: invalid replay status response: %w", err)
	}
	if _, err := time.Parse(time.RFC3339Nano, statusResult.CreatedAt); err != nil || statusResult.JobID != jobID || statusResult.UserID != expectedUserID || strings.TrimSpace(statusResult.Message) == "" {
		return SmileIdReplayResult{}, errors.New("smile id: replay status did not match the requested job and capture")
	}
	switch statusResult.Status {
	case "clear", "block", "attention", "error":
	default:
		return SmileIdReplayResult{}, errors.New("smile id: callback replay requires a terminal verification status")
	}
	var body strings.Builder
	form := multipart.NewWriter(&body)
	if err := form.Close(); err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: build replay request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, origin+"/v3/replay/"+jobID, strings.NewReader(body.String()))
	if err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: build replay request: %w", err)
	}
	request.Header.Set("Content-Type", form.FormDataContentType())
	request.Header.Set("Accept", "application/json")
	request.Header.Set("SmileID-Partner-ID", client.PartnerId)
	request.Header.Set("SmileID-Token", tokenResponse.Token)
	response, err := client.do(request)
	if err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: replay request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusAccepted {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		return SmileIdReplayResult{}, fmt.Errorf("smile id: replay request returned status %d", response.StatusCode)
	}
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	if err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: read replay response: %w", err)
	}
	if len(responseBody) > 1<<20 {
		return SmileIdReplayResult{}, errors.New("smile id: replay response exceeded the size limit")
	}
	var replayResponse struct {
		Status  string `json:"status"`
		JobID   string `json:"job_id"`
		UserID  string `json:"user_id"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(responseBody, &replayResponse); err != nil {
		return SmileIdReplayResult{}, fmt.Errorf("smile id: invalid replay response: %w", err)
	}
	if replayResponse.Status != "accepted" || replayResponse.JobID != jobID || replayResponse.UserID != expectedUserID || strings.TrimSpace(replayResponse.Message) == "" {
		return SmileIdReplayResult{}, errors.New("smile id: replay response did not match the requested job and capture")
	}
	return SmileIdReplayResult{Status: replayResponse.Status, JobID: replayResponse.JobID}, nil
}
