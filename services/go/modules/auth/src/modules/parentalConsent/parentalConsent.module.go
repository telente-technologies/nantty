package parentalconsent

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type ConsentStatus struct {
	Attested       bool       `json:"attested"`
	Status         string     `json:"status"`
	ConsentVersion string     `json:"consentVersion,omitempty"`
	AttestedAt     *time.Time `json:"attestedAt,omitempty"`
	RevokedAt      *time.Time `json:"revokedAt,omitempty"`
}

type Controller struct {
	Container *container.Container
}

func Mount(mux *http.ServeMux, deployed *container.Container) {
	controller := Controller{Container: deployed}
	requireUser := jwtauth.RequireVerifiedAccessToken(deployed.AccessVerifier)
	mux.Handle("GET /api/v1/auth/parental-consent", requireUser(http.HandlerFunc(controller.GetStatus)))
	mux.Handle("POST /api/v1/auth/parental-consent", requireUser(http.HandlerFunc(controller.Attest)))
	mux.Handle("DELETE /api/v1/auth/parental-consent", requireUser(http.HandlerFunc(controller.Revoke)))
}

func (controller Controller) GetStatus(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	accountId, err := uuid.Parse(principal.UserId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	var status, version string
	var attestedAt time.Time
	var revokedAt sql.NullTime
	err = controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT status, consent_version, attested_at, revoked_at FROM parental_consents WHERE account_id = $1`, accountId,
	).Scan(&status, &version, &attestedAt, &revokedAt)
	if err == sql.ErrNoRows {
		httpserver.WriteJsonResponse(writer, http.StatusOK, ConsentStatus{Attested: false, Status: "missing"})
		return
	}
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	out := ConsentStatus{
		Attested:       status == "attested" && !revokedAt.Valid,
		Status:         status,
		ConsentVersion: version,
		AttestedAt:     &attestedAt,
	}
	if revokedAt.Valid {
		out.RevokedAt = &revokedAt.Time
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, out)
}

func (controller Controller) Attest(writer http.ResponseWriter, request *http.Request) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusServiceUnavailable, "PARENTAL_CONSENT_UNAVAILABLE", "Guardian consent is not available yet."))
}

func (controller Controller) Revoke(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	accountId, err := uuid.Parse(principal.UserId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.ErrUnauthorized)
		return
	}
	now := controller.Container.Now().UTC()
	_, err = controller.Container.Database.ExecContext(request.Context(),
		`UPDATE parental_consents SET status = 'revoked', revoked_at = $1, updated_at = $1 WHERE account_id = $2`,
		now, accountId,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, ConsentStatus{Attested: false, Status: "revoked", RevokedAt: &now})
}
