package integrations_test

import (
	"context"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"nantty/modules/live/src/integrations"
)

func TestOnlyIdempotentCallsRetryAndOnlyOnUnavailable(t *testing.T) {
	options := integrations.InternalGrpcOptions{RetryAttempts: 3, RetryBackoff: time.Millisecond}
	cases := []struct {
		name         string
		idempotent   bool
		code         codes.Code
		wantAttempts int
	}{
		{"idempotent unavailable retries", true, codes.Unavailable, 3},
		{"non idempotent unavailable does not retry", false, codes.Unavailable, 1},
		{"idempotent deadline exceeded does not retry", true, codes.DeadlineExceeded, 1},
		{"idempotent invalid argument does not retry", true, codes.InvalidArgument, 1},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			attempts := 0
			_, err := integrations.CallWithRetryOnUnavailable(context.Background(), options, testCase.idempotent, func(context.Context) (int, error) {
				attempts++
				return 0, status.Error(testCase.code, "failed")
			})
			if err == nil || attempts != testCase.wantAttempts {
				t.Fatalf("attempts %d err %v, want %d attempts", attempts, err, testCase.wantAttempts)
			}
		})
	}
}
