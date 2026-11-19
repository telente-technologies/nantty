package childsafety

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/middlewares"
	"nantty/platform/httpserver"
)

var (
	ErrScannerUnconfigured  = errors.New("csam hash matcher is not configured")
	ErrReportingGateBlocked = errors.New("statutory reporting requires counsel-approved provider credentials")
)

type ScanRequest struct {
	MediaId    string `json:"mediaId"`
	OwnerId    string `json:"ownerId"`
	Sha256Hex  string `json:"sha256Hex"`
	Perceptual string `json:"perceptualHash,omitempty"`
}

type MatchVerdict struct {
	Matched      bool   `json:"matched"`
	Provider     string `json:"provider"`
	MatchListId  string `json:"matchListId,omitempty"`
	Confidence   int    `json:"confidence"`
	Quarantined  bool   `json:"quarantined"`
	ReportStatus string `json:"reportStatus,omitempty"`
}

type HashMatcher interface {
	ProviderName() string
	Match(ctx context.Context, req ScanRequest) (MatchVerdict, error)
}

type ReportingGateway interface {
	Submit(ctx context.Context, report StatutoryReport) (string, error)
}

type StatutoryReport struct {
	Id         string    `json:"id"`
	MediaId    string    `json:"mediaId"`
	OwnerId    string    `json:"ownerId"`
	Sha256Hex  string    `json:"sha256Hex"`
	Provider   string    `json:"provider"`
	Status     string    `json:"status"`
	DetectedAt time.Time `json:"detectedAt"`
}

type UnconfiguredHashMatcher struct{}

func (UnconfiguredHashMatcher) ProviderName() string { return "unconfigured" }
func (UnconfiguredHashMatcher) Match(context.Context, ScanRequest) (MatchVerdict, error) {
	return MatchVerdict{}, ErrScannerUnconfigured
}

type UnconfiguredReportingGateway struct{}

func (UnconfiguredReportingGateway) Submit(context.Context, StatutoryReport) (string, error) {
	return "", ErrReportingGateBlocked
}

type Pipeline struct {
	Database   *sql.DB
	Matcher    HashMatcher
	Reporter   ReportingGateway
	mu         sync.RWMutex
	Quarantine map[string]StatutoryReport
}

func NewPipelineFromEnv(database *sql.DB) *Pipeline {
	return &Pipeline{
		Database:   database,
		Matcher:    UnconfiguredHashMatcher{},
		Reporter:   UnconfiguredReportingGateway{},
		Quarantine: map[string]StatutoryReport{},
	}
}

func (pipeline *Pipeline) ScanAndQuarantine(ctx context.Context, req ScanRequest) (MatchVerdict, error) {
	if strings.TrimSpace(req.MediaId) == "" || strings.TrimSpace(req.OwnerId) == "" || len(strings.TrimSpace(req.Sha256Hex)) != 64 {
		return MatchVerdict{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_MEDIA_SCAN", "mediaId, ownerId and 64-char sha256Hex are required.")
	}
	if _, err := hex.DecodeString(req.Sha256Hex); err != nil {
		return MatchVerdict{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_MEDIA_SCAN", "sha256Hex must be valid hex.")
	}
	if pipeline.Matcher == nil {
		return MatchVerdict{}, ErrScannerUnconfigured
	}
	verdict, err := pipeline.Matcher.Match(ctx, req)
	if err != nil {
		if errors.Is(err, ErrScannerUnconfigured) {
			return MatchVerdict{}, httpserver.NewApiError(http.StatusServiceUnavailable, "CSAM_SCANNER_NOT_CONFIGURED", "CSAM hash matching is fail-closed until vetted PhotoDNA/NCMEC credentials are configured.")
		}
		return MatchVerdict{}, err
	}
	if !verdict.Matched {
		return verdict, nil
	}
	verdict.Quarantined = true
	now := time.Now().UTC()
	report := StatutoryReport{
		Id: uuid.NewString(), MediaId: req.MediaId, OwnerId: req.OwnerId,
		Sha256Hex: strings.ToLower(req.Sha256Hex), Provider: verdict.Provider,
		Status: "quarantined_pending_counsel_gate", DetectedAt: now,
	}
	if pipeline.Database != nil {
		_, dbErr := pipeline.Database.ExecContext(ctx,
			`INSERT INTO child_safety_quarantine
			 (id, media_id, owner_id, sha256_hex, perceptual_hash, provider, match_list_id, confidence, status, report_reference, detected_at, updated_at)
			 VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), $8, $9, NULLIF($10, ''), $11, $11)
			 ON CONFLICT (media_id) DO UPDATE SET
			   status = EXCLUDED.status, report_reference = COALESCE(EXCLUDED.report_reference, child_safety_quarantine.report_reference),
			   confidence = GREATEST(child_safety_quarantine.confidence, EXCLUDED.confidence), updated_at = EXCLUDED.updated_at`,
			uuid.MustParse(report.Id), report.MediaId, report.OwnerId, report.Sha256Hex, strings.TrimSpace(req.Perceptual),
			report.Provider, strings.TrimSpace(verdict.MatchListId), verdict.Confidence, report.Status, "", now,
		)
		if dbErr != nil {
			return MatchVerdict{}, dbErr
		}
	} else {
		pipeline.mu.Lock()
		pipeline.Quarantine[req.MediaId] = report
		pipeline.mu.Unlock()
	}
	if pipeline.Reporter != nil {
		if ref, repErr := pipeline.Reporter.Submit(ctx, report); repErr == nil && ref != "" {
			report.Status = "reported:" + ref
			if pipeline.Database != nil {
				if _, err := pipeline.Database.ExecContext(ctx,
					`UPDATE child_safety_quarantine SET status = $2, report_reference = $3, updated_at = now() WHERE media_id = $1`,
					req.MediaId, report.Status, ref,
				); err != nil {
					return MatchVerdict{}, err
				}
			} else {
				pipeline.mu.Lock()
				pipeline.Quarantine[req.MediaId] = report
				pipeline.mu.Unlock()
			}
		}
	}
	verdict.ReportStatus = report.Status
	return verdict, nil
}

func (pipeline *Pipeline) ListQuarantined(ctx context.Context) ([]StatutoryReport, error) {
	if pipeline.Database != nil {
		rows, err := pipeline.Database.QueryContext(ctx,
			`SELECT id::text, media_id, owner_id, sha256_hex, provider, status, detected_at
			 FROM child_safety_quarantine ORDER BY detected_at DESC LIMIT 200`,
		)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []StatutoryReport{}
		for rows.Next() {
			var rep StatutoryReport
			if err := rows.Scan(&rep.Id, &rep.MediaId, &rep.OwnerId, &rep.Sha256Hex, &rep.Provider, &rep.Status, &rep.DetectedAt); err != nil {
				return nil, err
			}
			out = append(out, rep)
		}
		return out, rows.Err()
	}
	pipeline.mu.RLock()
	defer pipeline.mu.RUnlock()
	out := make([]StatutoryReport, 0, len(pipeline.Quarantine))
	for _, rep := range pipeline.Quarantine {
		out = append(out, rep)
	}
	return out, nil
}

func Mount(mux *http.ServeMux, deployed *container.Container) {
	pipeline := NewPipelineFromEnv(deployed.Database)
	internalToken := httpserver.RequireInternalToken(os.Getenv("MODERATION_INTERNAL_API_TOKEN"))
	requireTrust := middlewares.RequireStaffWithAnyPermission(deployed.StaffVerifiers, []string{"moderation:reports"}, false)

	mux.Handle("POST /api/v1/internal/moderation/child-safety/scan", internalToken(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var body ScanRequest
		if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
			httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
			return
		}
		verdict, err := pipeline.ScanAndQuarantine(request.Context(), body)
		if err != nil {
			httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
			return
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, verdict)
	})))

	mux.Handle("GET /api/v1/admin/moderation/child-safety/quarantine", requireTrust(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		items, err := pipeline.ListQuarantined(request.Context())
		if err != nil {
			httpserver.WriteErrorResponse(writer, request, deployed.Logger, err)
			return
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"items": items})
	})))
}

func HashBytesHex(raw []byte) string {
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
