package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"slices"
	"strings"

	"zudomart/modules/creators/src/modules/affiliates/dtos"
	"zudomart/modules/creators/src/modules/affiliates/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
)

var (
	catalogSorts    = []string{"", "newest", "commission", "price_asc", "price_desc"}
	catalogAccesses = []string{"", "all", "approved", "requestable", "requested"}
	earningStatuses = []string{"pending", "earned", "reversed"}
)

func (controller AffiliatesController) AffiliateCatalog(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	query := request.URL.Query()
	filter := services.CatalogFilter{Search: strings.TrimSpace(query.Get("q")), StoreId: query.Get("storeId"), Sort: query.Get("sort"), Access: query.Get("access"), Cursor: query.Get("cursor"),
		Limit: ledgerutils.ReadPageLimit(request)}
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("q", filter.Search, 0, 80)
	collector.RequireLength("storeId", filter.StoreId, 0, 80)
	if !slices.Contains(catalogSorts, filter.Sort) {
		collector.Add("sort", "must be newest, commission, price_asc or price_desc")
	}
	if !slices.Contains(catalogAccesses, filter.Access) {
		collector.Add("access", "must be all, approved, requestable or requested")
	}
	if err := collector.Result(); err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, next, err := controller.Affiliates.ListPromotableProducts(request.Context(), principal.UserId, filter)
	controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, next), err)
}

func (controller AffiliatesController) AffiliatePromotions(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	views, err := controller.Affiliates.ListPromotions(request.Context(), principal.UserId)
	controller.respond(writer, request, http.StatusOK, httpserver.NewCursorPage(views, ""), err)
}

func (controller AffiliatesController) AffiliateEarnings(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	status := request.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}
	if !slices.Contains(earningStatuses, status) {
		collector := &ledgerutils.IssueCollector{}
		collector.Add("status", "must be pending, earned or reversed")
		controller.fail(writer, request, collector.Result())
		return
	}
	page, err := controller.Affiliates.ListAffiliateEarnings(request.Context(), principal.UserId, status, request.URL.Query().Get("cursor"), ledgerutils.ReadPageLimit(request))
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller AffiliatesController) CreateAffiliateLink(writer http.ResponseWriter, request *http.Request) {
	principal, err := ledgerutils.RequirePrincipal(request)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.AffiliateLinkRequestDto) error {
		collector := &ledgerutils.IssueCollector{}
		collector.RequireLength("productId", body.ProductId, 1, 80)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	view, err := controller.Affiliates.CreateAffiliateLink(request.Context(), principal.UserId, body.ProductId)
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller AffiliatesController) RecordAffiliateLinkClick(writer http.ResponseWriter, request *http.Request) {
	viewer := services.AffiliateLinkViewer{UserId: ledgerutils.ReadOptionalPrincipalUserId(request, controller.Affiliates.Container.Resources.AccessVerifier)}
	if viewer.UserId == "" {
		viewer.GuestKey = guestKeyOf(request)
	}
	view, err := controller.Affiliates.RecordAffiliateLinkClick(request.Context(), request.PathValue("linkId"), viewer)
	controller.respond(writer, request, http.StatusOK, view, err)
}

// guestKeyOf prefers the visitor id the web and mobile apps keep on the device; older clients fall back to a digest of the
// forwarded address and user agent, so no raw address is ever stored.
func guestKeyOf(request *http.Request) string {
	var body dtos.AffiliateLinkClickDto
	if request.ContentLength != 0 {
		_ = json.NewDecoder(http.MaxBytesReader(nil, request.Body, 1024)).Decode(&body)
	}
	if visitor := strings.TrimSpace(body.VisitorId); len(visitor) >= 8 && len(visitor) <= 80 {
		return "visitor:" + visitor
	}
	address := strings.TrimSpace(strings.Split(request.Header.Get("X-Forwarded-For"), ",")[0])
	if address == "" {
		address = request.RemoteAddr
		if host, _, err := net.SplitHostPort(address); err == nil {
			address = host
		}
	}
	digest := sha256.Sum256([]byte(address + "|" + request.UserAgent()))
	return "network:" + hex.EncodeToString(digest[:])
}
