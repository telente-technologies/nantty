package telemetry

import (
	"fmt"
	"net"
	"net/http"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var durationBucketsSeconds = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}

type routeKey struct {
	method      string
	route       string
	statusClass string
}

type routeSeries struct {
	count   uint64
	sum     float64
	buckets []uint64
}

type HttpMetrics struct {
	mutex    sync.Mutex
	series   map[routeKey]*routeSeries
	counters map[string]func() int64
}

func NewHttpMetrics() *HttpMetrics {
	return &HttpMetrics{series: map[routeKey]*routeSeries{}, counters: map[string]func() int64{}}
}

func (metrics *HttpMetrics) AddCounter(name string, read func() int64) {
	metrics.mutex.Lock()
	defer metrics.mutex.Unlock()
	metrics.counters[name] = read
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (recorder *statusRecorder) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func (recorder *statusRecorder) Unwrap() http.ResponseWriter { return recorder.ResponseWriter }

func (metrics *HttpMetrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: writer, status: http.StatusOK}
		next.ServeHTTP(recorder, request)
		route := request.Pattern
		if route == "" {
			route = "unmatched"
		}
		metrics.observe(routeKey{method: request.Method, route: route, statusClass: strconv.Itoa(recorder.status/100) + "xx"}, time.Since(started).Seconds())
	})
}

func (metrics *HttpMetrics) observe(key routeKey, seconds float64) {
	metrics.mutex.Lock()
	defer metrics.mutex.Unlock()
	series, found := metrics.series[key]
	if !found {
		series = &routeSeries{buckets: make([]uint64, len(durationBucketsSeconds))}
		metrics.series[key] = series
	}
	series.count++
	series.sum += seconds
	for index, bound := range durationBucketsSeconds {
		if seconds <= bound {
			series.buckets[index]++
		}
	}
}

func (metrics *HttpMetrics) ServeLoopbackOnly(writer http.ResponseWriter, request *http.Request) {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil || !net.ParseIP(host).IsLoopback() || request.Header.Get("X-Forwarded-For") != "" {
		http.NotFound(writer, request)
		return
	}
	writer.Header().Set("Content-Type", "text/plain; version=0.0.4")
	_, _ = writer.Write([]byte(metrics.Render()))
}

func (metrics *HttpMetrics) Render() string {
	metrics.mutex.Lock()
	keys := make([]routeKey, 0, len(metrics.series))
	snapshot := make(map[routeKey]routeSeries, len(metrics.series))
	for key, series := range metrics.series {
		keys = append(keys, key)
		snapshot[key] = routeSeries{count: series.count, sum: series.sum, buckets: append([]uint64(nil), series.buckets...)}
	}
	counterNames := make([]string, 0, len(metrics.counters))
	counters := make(map[string]func() int64, len(metrics.counters))
	for name, read := range metrics.counters {
		counterNames = append(counterNames, name)
		counters[name] = read
	}
	metrics.mutex.Unlock()
	sort.Strings(counterNames)
	sort.Slice(keys, func(left, right int) bool {
		return fmt.Sprint(keys[left]) < fmt.Sprint(keys[right])
	})
	var output strings.Builder
	output.WriteString("# TYPE http_server_request_duration_seconds histogram\n")
	for _, key := range keys {
		series := snapshot[key]
		labels := fmt.Sprintf(`method="%s",route="%s",status_class="%s"`, key.method, escapeLabel(key.route), key.statusClass)
		for index, bound := range durationBucketsSeconds {
			fmt.Fprintf(&output, "http_server_request_duration_seconds_bucket{%s,le=\"%g\"} %d\n", labels, bound, series.buckets[index])
		}
		fmt.Fprintf(&output, "http_server_request_duration_seconds_bucket{%s,le=\"+Inf\"} %d\n", labels, series.count)
		fmt.Fprintf(&output, "http_server_request_duration_seconds_sum{%s} %g\n", labels, series.sum)
		fmt.Fprintf(&output, "http_server_request_duration_seconds_count{%s} %d\n", labels, series.count)
	}
	for _, name := range counterNames {
		fmt.Fprintf(&output, "# TYPE %s counter\n%s %d\n", name, name, counters[name]())
	}
	output.WriteString("# TYPE go_goroutines gauge\n")
	fmt.Fprintf(&output, "go_goroutines %d\n", runtime.NumGoroutine())
	return output.String()
}

func escapeLabel(value string) string {
	return strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`).Replace(value)
}
