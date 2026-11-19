package httpserver_test

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"

	"nantty/platform/httpserver"
)

func TestConfiguredWriteTimeoutStopsSlowResponse(t *testing.T) {
	probe, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := probe.Addr().String()
	if err := probe.Close(); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	serveDone := make(chan error, 1)
	go func() {
		serveDone <- httpserver.RunHttpServerUntilContextDone(ctx, httpserver.ServerOptions{
			Address: address,
			Handler: http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				time.Sleep(200 * time.Millisecond)
				_, _ = io.WriteString(writer, "late")
			}),
			Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
			WriteTimeout: 50 * time.Millisecond,
		})
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case err := <-serveDone:
			if err != nil {
				t.Errorf("server shutdown: %v", err)
			}
		case <-time.After(time.Second):
			t.Error("server did not stop after cancellation")
		}
	})

	client := &http.Client{Timeout: time.Second}
	deadline := time.Now().Add(time.Second)
	for {
		if connection, dialErr := net.DialTimeout("tcp", address, 20*time.Millisecond); dialErr == nil {
			connection.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("server did not become reachable before deadline")
		}
		time.Sleep(10 * time.Millisecond)
	}
	response, requestErr := client.Get("http://" + address)
	if requestErr == nil {
		response.Body.Close()
		t.Fatal("slow response unexpectedly completed before the configured write timeout")
	}
}
