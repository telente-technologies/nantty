package httpserver

import (
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
)

var (
	trustedCIDRs     []*net.IPNet
	trustedCIDRsOnce sync.Once
)

func initTrustedCIDRs() {
	defaultCIDRs := []string{
		"127.0.0.0/8",
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"::1/128",
		"fc00::/7",
	}

	envCIDRs := os.Getenv("TRUSTED_PROXY_CIDRS")
	if envCIDRs != nilStr() {
		defaultCIDRs = append(defaultCIDRs, strings.Split(envCIDRs, ",")...)
	}

	for _, cidrStr := range defaultCIDRs {
		cidrStr = strings.TrimSpace(cidrStr)
		if cidrStr == "" {
			continue
		}
		_, cidr, err := net.ParseCIDR(cidrStr)
		if err == nil {
			trustedCIDRs = append(trustedCIDRs, cidr)
		}
	}
}

func nilStr() string {
	return ""
}

func isTrustedPeer(remoteAddr string) bool {
	trustedCIDRsOnce.Do(initTrustedCIDRs)
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	for _, cidr := range trustedCIDRs {
		if cidr.Contains(ip) {
			return true
		}
	}
	return false
}

func IsFromTrustedProxy(req *http.Request) bool {
	return isTrustedPeer(req.RemoteAddr)
}

func IsFromTrustedNetwork(req *http.Request) bool {
	return isTrustedPeer(req.RemoteAddr) && req.Header.Get("X-Forwarded-For") == ""
}

func ClientIP(req *http.Request) string {
	remoteHost, _, err := net.SplitHostPort(req.RemoteAddr)
	if err != nil {
		remoteHost = req.RemoteAddr
	}

	if !isTrustedPeer(req.RemoteAddr) {
		return remoteHost
	}

	xff := req.Header.Get("X-Forwarded-For")
	if xff != "" {
		hops := strings.Split(xff, ",")
		for i := len(hops) - 1; i >= 0; i-- {
			hop := strings.TrimSpace(hops[i])
			if hop != "" {
				parsed := net.ParseIP(hop)
				if parsed != nil && !isTrustedIP(parsed) {
					return hop
				}
			}
		}
		for _, hop := range hops {
			trimmed := strings.TrimSpace(hop)
			if trimmed != "" {
				return trimmed
			}
		}
	}

	realIP := strings.TrimSpace(req.Header.Get("X-Real-Ip"))
	if realIP != "" {
		return realIP
	}

	return remoteHost
}

func isTrustedIP(ip net.IP) bool {
	for _, cidr := range trustedCIDRs {
		if cidr.Contains(ip) {
			return true
		}
	}
	return false
}
