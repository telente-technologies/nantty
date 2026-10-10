package staffaudit

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type Record struct {
	ActorId        string          `json:"actorId"`
	ActorName      string          `json:"actorName"`
	ActorRole      string          `json:"actorRole"`
	Action         string          `json:"action"`
	SubjectType    string          `json:"subjectType"`
	SubjectId      string          `json:"subjectId"`
	SubjectLabel   string          `json:"subjectLabel"`
	Before         json.RawMessage `json:"before,omitempty"`
	After          json.RawMessage `json:"after,omitempty"`
	Reason         string          `json:"reason"`
	IpAddress      string          `json:"ipAddress"`
	RequestId      string          `json:"requestId"`
	StepUpVerified bool            `json:"stepUpVerified"`
}

type Recorder interface {
	Record(ctx context.Context, record Record) error
}

type HttpRecorder struct {
	BaseUrl string
	Token   string
	Client  *http.Client
}

func NewHttpRecorder(baseUrl, token string) HttpRecorder {
	return HttpRecorder{BaseUrl: strings.TrimRight(baseUrl, "/"), Token: token, Client: &http.Client{Timeout: 3 * time.Second}}
}

func (recorder HttpRecorder) Record(ctx context.Context, record Record) error {
	if recorder.BaseUrl == "" {
		return fmt.Errorf("staff audit is not configured")
	}
	body, err := json.Marshal(record)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, recorder.BaseUrl+"/api/v1/internal/audit/events", bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", recorder.Token)
	response, err := recorder.Client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return fmt.Errorf("staff audit returned %d", response.StatusCode)
	}
	return nil
}

func Snapshot(value any) json.RawMessage {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	return encoded
}

func RecordStaffChange(request *http.Request, recorder Recorder, staff staffauth.Staff, action, subjectType, subjectId, reason string, before, after any) error {
	if recorder == nil {
		return fmt.Errorf("staff audit is not configured")
	}
	return recorder.Record(request.Context(), Record{
		ActorId: staff.Id, ActorName: staff.Name, ActorRole: staff.Role, Action: action, SubjectType: subjectType, SubjectId: subjectId, SubjectLabel: subjectId,
		Before: Snapshot(before), After: Snapshot(after), Reason: reason, IpAddress: httpserver.ClientIP(request), RequestId: request.Header.Get("X-Request-Id"), StepUpVerified: staff.SteppedUp,
	})
}
