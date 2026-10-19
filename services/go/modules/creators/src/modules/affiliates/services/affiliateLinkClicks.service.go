package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliatelinkvisit"
)

const affiliateClickCountingWindow = 24 * time.Hour

// AffiliateLinkViewer identifies who opened a link without keeping a raw identifier: the signed-in user id, or else a
// guest key (a device id from the app, or a digest the controller builds from request details). Only its hash is stored.
type AffiliateLinkViewer struct {
	UserId   string
	GuestKey string
}

func (viewer AffiliateLinkViewer) storedKey() string {
	source := "guest:" + viewer.GuestKey
	if viewer.UserId != "" {
		source = "user:" + viewer.UserId
	} else if viewer.GuestKey == "" {
		return ""
	}
	digest := sha256.Sum256([]byte(source))
	return hex.EncodeToString(digest[:])
}

func (affiliates Affiliates) RecordAffiliateLinkClick(ctx context.Context, linkId string, viewer AffiliateLinkViewer) (AffiliateLinkClickView, error) {
	id, err := uuid.Parse(linkId)
	if err != nil {
		return AffiliateLinkClickView{}, ErrAffiliateLinkMissing
	}
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	link, err := client.AffiliateLink.Get(ctx, id)
	if ent.IsNotFound(err) {
		return AffiliateLinkClickView{}, ErrAffiliateLinkMissing
	}
	if err != nil {
		return AffiliateLinkClickView{}, err
	}
	now := affiliates.Container.Now().UTC()
	if viewer.UserId != link.CreatorID && viewer.storedKey() != "" {
		if err := affiliates.countClickOncePerDay(ctx, link, viewer.storedKey(), now); err != nil {
			return AffiliateLinkClickView{}, err
		}
	}
	settings, err := affiliates.settingsRow(ctx, client, link.StoreID)
	if err != nil {
		return AffiliateLinkClickView{}, err
	}
	window := max(convertSettings(settings).CookieWindowDays, 1)
	return AffiliateLinkClickView{ProductId: link.ProductID, Attribution: SaleAttributionView{Source: "link", Id: link.ID.String()}, AttributionWindowDays: window,
		ExpiresAt: now.Add(time.Duration(window) * 24 * time.Hour)}, nil
}

func (affiliates Affiliates) countClickOncePerDay(ctx context.Context, link *ent.AffiliateLink, viewerKey string, now time.Time) error {
	return affiliates.inTransaction(ctx, func(ctx context.Context, transaction *sql.Tx, client *ent.Client) error {
		if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "affiliate-click:"+link.ID.String()+":"+viewerKey); err != nil {
			return err
		}
		visit, err := client.AffiliateLinkVisit.Query().Where(affiliatelinkvisit.LinkID(link.ID.String()), affiliatelinkvisit.ViewerKey(viewerKey)).Only(ctx)
		switch {
		case ent.IsNotFound(err):
			err = client.AffiliateLinkVisit.Create().SetLinkID(link.ID.String()).SetViewerKey(viewerKey).SetLastCountedAt(now).SetCreatedAt(now).Exec(ctx)
		case err != nil:
			return err
		case now.Sub(visit.LastCountedAt) < affiliateClickCountingWindow:
			return nil
		default:
			err = visit.Update().SetLastCountedAt(now).Exec(ctx)
		}
		if err != nil {
			return err
		}
		return client.AffiliateLink.UpdateOneID(link.ID).AddClicks(1).SetLastClickedAt(now).Exec(ctx)
	})
}
