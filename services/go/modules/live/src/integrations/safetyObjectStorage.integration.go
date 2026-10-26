package integrations

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"nantty/modules/live/src/interfaces"
)

var ErrSafetyCaptureUnavailable = errors.New("live safety capture is not configured")

type S3SafetyObjectLister struct {
	bucket string
	client *s3.Client
}

func NewS3SafetyObjectLister(ctx context.Context, bucket, region, endpoint string) (*S3SafetyObjectLister, error) {
	awsConfig, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(awsConfig, func(options *s3.Options) {
		if endpoint != "" {
			options.BaseEndpoint = aws.String(endpoint)
			options.UsePathStyle = true
		}
	})
	return &S3SafetyObjectLister{bucket: bucket, client: client}, nil
}

func (lister *S3SafetyObjectLister) ListObjectsAfter(ctx context.Context, prefix, startAfter string, limit int) ([]interfaces.StoredSafetyObject, error) {
	input := &s3.ListObjectsV2Input{Bucket: aws.String(lister.bucket), Prefix: aws.String(prefix), MaxKeys: aws.Int32(int32(limit))}
	if startAfter != "" {
		input.StartAfter = aws.String(startAfter)
	}
	output, err := lister.client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, err
	}
	objects := make([]interfaces.StoredSafetyObject, 0, len(output.Contents))
	for _, item := range output.Contents {
		objects = append(objects, interfaces.StoredSafetyObject{Key: aws.ToString(item.Key), LastModified: aws.ToTime(item.LastModified)})
	}
	return objects, nil
}

type UnconfiguredSafetyCapture struct{}

func (UnconfiguredSafetyCapture) StartFrameCapture(context.Context, string, string, time.Duration, int) (string, error) {
	return "", ErrSafetyCaptureUnavailable
}

func (UnconfiguredSafetyCapture) StartAudioCapture(context.Context, string, string, time.Duration) (string, error) {
	return "", ErrSafetyCaptureUnavailable
}

func (UnconfiguredSafetyCapture) StopCapture(context.Context, string) error { return nil }

func (UnconfiguredSafetyCapture) ListObjectsAfter(context.Context, string, string, int) ([]interfaces.StoredSafetyObject, error) {
	return nil, ErrSafetyCaptureUnavailable
}

type InMemorySafetyCapture struct {
	mutex   sync.Mutex
	Started map[string]string
	Stopped []string
	Objects map[string][]interfaces.StoredSafetyObject
}

func NewInMemorySafetyCapture() *InMemorySafetyCapture {
	return &InMemorySafetyCapture{Started: map[string]string{}, Objects: map[string][]interfaces.StoredSafetyObject{}}
}

func (capture *InMemorySafetyCapture) StartFrameCapture(_ context.Context, _, prefix string, _ time.Duration, _ int) (string, error) {
	capture.mutex.Lock()
	defer capture.mutex.Unlock()
	identifier := "EG_FRAMES_" + prefix
	capture.Started[identifier] = prefix
	return identifier, nil
}

func (capture *InMemorySafetyCapture) StartAudioCapture(_ context.Context, _, prefix string, _ time.Duration) (string, error) {
	capture.mutex.Lock()
	defer capture.mutex.Unlock()
	identifier := "EG_AUDIO_" + prefix
	capture.Started[identifier] = prefix
	return identifier, nil
}

func (capture *InMemorySafetyCapture) StopCapture(_ context.Context, egressId string) error {
	capture.mutex.Lock()
	defer capture.mutex.Unlock()
	capture.Stopped = append(capture.Stopped, egressId)
	return nil
}

func (capture *InMemorySafetyCapture) ListObjectsAfter(_ context.Context, prefix, startAfter string, limit int) ([]interfaces.StoredSafetyObject, error) {
	capture.mutex.Lock()
	defer capture.mutex.Unlock()
	var matched []interfaces.StoredSafetyObject
	for _, object := range capture.Objects[prefix] {
		if object.Key > startAfter && len(matched) < limit {
			matched = append(matched, object)
		}
	}
	return matched, nil
}
