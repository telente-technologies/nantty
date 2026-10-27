package getsecurityoverview

import (
	"context"
	"net"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/session"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, query Query) (SecurityOverviewView, error) {
	owner, err := uuid.Parse(query.AccountId)
	if err != nil {
		return SecurityOverviewView{}, authErrors.ErrInvalidRefreshToken
	}
	rows, err := application.Client.Session.Query().Where(session.AccountID(owner)).Order(ent.Desc(session.FieldID)).Limit(100).All(ctx)
	if err != nil {
		return SecurityOverviewView{}, err
	}
	now := application.Now()
	overview := SecurityOverviewView{Sessions: []SecuritySessionView{}, LoginHistory: []LoginHistoryView{}}
	for _, row := range rows {
		device, app := DescribeUserAgent(row.UserAgent)
		if len(overview.LoginHistory) < 20 {
			overview.LoginHistory = append(overview.LoginHistory, LoginHistoryView{Id: row.ID.String(), Outcome: "success", Device: device, Location: "Unknown location", IpAddress: MaskIpAddress(row.IPAddress), OccurredAt: row.CreatedAt.UTC().Format(time.RFC3339)})
		}
		if row.RevokedAt != nil || !row.ExpiresAt.After(now) || !row.CreatedAt.After(now.Add(-application.Settings.SessionMaximumLifetime)) {
			continue
		}
		overview.Sessions = append(overview.Sessions, SecuritySessionView{Id: row.ID.String(), Device: device, App: app, Location: "Unknown location", IpAddress: MaskIpAddress(row.IPAddress),
			SignedInAt: row.CreatedAt.UTC().Format(time.RFC3339), LastActiveAt: row.LastUsedAt.UTC().Format(time.RFC3339), IsCurrent: row.ID.String() == query.CurrentSessionId})
	}
	return overview, nil
}

func DescribeUserAgent(userAgent string) (string, string) {
	lowered := strings.ToLower(userAgent)
	if strings.Contains(lowered, "nantty") || strings.Contains(lowered, "nantty") || strings.Contains(lowered, "okhttp") || strings.Contains(lowered, "cfnetwork") || strings.Contains(lowered, "expo") {
		platform := "phone"
		if strings.Contains(lowered, "iphone") || strings.Contains(lowered, "ios") || strings.Contains(lowered, "cfnetwork") {
			platform = "iPhone"
		} else if strings.Contains(lowered, "android") || strings.Contains(lowered, "okhttp") {
			platform = "Android"
		}
		return "Nantty app on " + platform, "mobile_app"
	}
	browser := "Browser"
	for _, candidate := range []struct{ token, name string }{{"edg/", "Edge"}, {"firefox", "Firefox"}, {"chrome", "Chrome"}, {"safari", "Safari"}} {
		if strings.Contains(lowered, candidate.token) {
			browser = candidate.name
			break
		}
	}
	system := "an unknown device"
	for _, candidate := range []struct{ token, name string }{{"windows", "Windows"}, {"mac os", "macOS"}, {"android", "Android"}, {"iphone", "iPhone"}, {"linux", "Linux"}} {
		if strings.Contains(lowered, candidate.token) {
			system = candidate.name
			break
		}
	}
	return browser + " on " + system, "dashboard"
}

func MaskIpAddress(address string) string {
	parsed := net.ParseIP(address)
	if parsed == nil {
		return "Unknown"
	}
	if ipv4 := parsed.To4(); ipv4 != nil {
		parts := strings.Split(ipv4.String(), ".")
		return parts[0] + "." + parts[1] + ".•••." + parts[3]
	}
	groups := strings.Split(parsed.String(), ":")
	return strings.Join(groups[:min(2, len(groups))], ":") + ":••••"
}
