package integrations

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"time"

	"zudomart/modules/live/src/interfaces"
)

type InMemoryIngressController struct {
	mutex   sync.Mutex
	counter int
	Active  map[string]interfaces.IngressCredentials
	Deleted []string
}

func NewInMemoryIngressController() *InMemoryIngressController {
	return &InMemoryIngressController{Active: map[string]interfaces.IngressCredentials{}}
}

func (controller *InMemoryIngressController) CreateIngress(_ context.Context, request interfaces.IngressRequest) (interfaces.IngressCredentials, error) {
	controller.mutex.Lock()
	defer controller.mutex.Unlock()
	controller.counter++
	suffix := strconv.Itoa(controller.counter)
	credentials := interfaces.IngressCredentials{IngressId: "IN_" + suffix, Url: "rtmp://ingest.test/x", StreamKey: "key-" + string(request.Protocol) + "-" + suffix + "-abcdef"}
	if request.Protocol == interfaces.IngressWhip {
		credentials.Url = "https://ingest.test/w"
	}
	controller.Active[credentials.IngressId] = credentials
	return credentials, nil
}

func (controller *InMemoryIngressController) GetIngress(_ context.Context, ingressId string) (interfaces.IngressCredentials, error) {
	controller.mutex.Lock()
	defer controller.mutex.Unlock()
	credentials, known := controller.Active[ingressId]
	if !known {
		return interfaces.IngressCredentials{}, ErrIngressMissing
	}
	return credentials, nil
}

func (controller *InMemoryIngressController) DeleteIngress(_ context.Context, ingressId string) error {
	controller.mutex.Lock()
	defer controller.mutex.Unlock()
	delete(controller.Active, ingressId)
	controller.Deleted = append(controller.Deleted, ingressId)
	return nil
}

type InMemoryRecordingController struct {
	mutex   sync.Mutex
	counter int
	Started map[string]string
	Stopped []string
	Failure error
}

func NewInMemoryRecordingController() *InMemoryRecordingController {
	return &InMemoryRecordingController{Started: map[string]string{}}
}

func (controller *InMemoryRecordingController) StartRoomRecording(_ context.Context, _, objectKey string) (string, error) {
	controller.mutex.Lock()
	defer controller.mutex.Unlock()
	if controller.Failure != nil {
		return "", controller.Failure
	}
	controller.counter++
	identifier := "EG_" + strconv.Itoa(controller.counter)
	controller.Started[identifier] = objectKey
	return identifier, nil
}

func (controller *InMemoryRecordingController) StopRecording(_ context.Context, egressId string) error {
	controller.mutex.Lock()
	defer controller.mutex.Unlock()
	controller.Stopped = append(controller.Stopped, egressId)
	return nil
}

type InMemoryRecordingStorage struct{}

func (InMemoryRecordingStorage) PresignDownload(_ context.Context, objectKey string, timeToLive time.Duration) (string, error) {
	return "https://recordings.test/" + objectKey + "?ttl=" + timeToLive.String(), nil
}

type UnconfiguredRecording struct{}

var ErrRecordingUnavailable = errors.New("recording is not configured")

func (UnconfiguredRecording) StartRoomRecording(context.Context, string, string) (string, error) {
	return "", ErrRecordingUnavailable
}

func (UnconfiguredRecording) StopRecording(context.Context, string) error { return nil }

func (UnconfiguredRecording) PresignDownload(context.Context, string, time.Duration) (string, error) {
	return "", ErrRecordingUnavailable
}
