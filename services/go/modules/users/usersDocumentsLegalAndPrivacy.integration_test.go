package users

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"zudomart/modules/users/src/integrations"
)

type fakeDocumentStorage struct {
	mutex    sync.Mutex
	uploaded map[string]bool
}

func (storage *fakeDocumentStorage) PresignUpload(_ context.Context, key, _ string, _ int64, _ time.Duration) (integrations.UploadTicket, error) {
	return integrations.UploadTicket{Url: "https://upload.test/" + key, Headers: map[string]string{"Content-Type": "application/pdf"}}, nil
}

func (storage *fakeDocumentStorage) PresignView(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://view.test/" + key + "?signature=1", nil
}

func (storage *fakeDocumentStorage) Exists(_ context.Context, key string) (bool, error) {
	storage.mutex.Lock()
	defer storage.mutex.Unlock()
	return storage.uploaded[key], nil
}

func (storage *fakeDocumentStorage) markUploaded(key string) {
	storage.mutex.Lock()
	storage.uploaded[key] = true
	storage.mutex.Unlock()
}

func TestBusinessDocumentsUploadReviewAndGoldEligibility(t *testing.T) {
	storage := &fakeDocumentStorage{uploaded: map[string]bool{}}
	integrations.UseDocumentStorageForTests(storage)
	harness := startUsersModuleAgainstFreshSchema(t)
	_, token := harness.newAccount("shop.owner", "Shop Owner")
	store := harness.expect("POST", "/api/v1/users/me/business-profiles", token, map[string]any{"displayName": "Corner Shop", "handle": "corner.shop", "description": "Goods", "categories": []map[string]any{{"customName": "Retail"}}}, http.StatusCreated)
	storeId := store["id"].(string)

	empty := harness.expect("GET", "/api/v1/seller/business-documents", token, nil, http.StatusOK)
	if empty["allApproved"] != false || len(empty["documents"].([]any)) != 3 || empty["documents"].([]any)[0].(map[string]any)["status"] != "not_uploaded" {
		t.Fatalf("unexpected %v", empty)
	}
	harness.expect("POST", "/api/v1/seller/business-documents/cac_certificate/upload-intents", token, map[string]any{"fileName": "cac.exe", "contentType": "application/x-msdownload", "sizeBytes": 100}, http.StatusBadRequest)
	harness.expect("POST", "/api/v1/seller/business-documents/passport/upload-intents", token, map[string]any{"fileName": "a.pdf", "contentType": "application/pdf", "sizeBytes": 100}, http.StatusNotFound)
	kinds := []string{"cac_certificate", "identity", "address_proof"}
	for _, kind := range kinds {
		intent := harness.expect("POST", "/api/v1/seller/business-documents/"+kind+"/upload-intents", token, map[string]any{"fileName": kind + ".pdf", "contentType": "application/pdf", "sizeBytes": 2048}, http.StatusCreated)
		if !strings.HasPrefix(intent["uploadUrl"].(string), "https://upload.test/business-documents/") {
			t.Fatalf("unexpected intent %v", intent)
		}
		harness.expect("PUT", "/api/v1/seller/business-documents/"+kind, token, map[string]any{"documentId": intent["documentId"]}, http.StatusConflict)
		storage.markUploaded(intent["objectKey"].(string))
		harness.expect("PUT", "/api/v1/seller/business-documents/"+kind, token, map[string]any{"fileUrl": intent["uploadUrl"]}, http.StatusOK)
	}

	reviewer, _ := harness.staff("admin", "verification:review", "verification:documents", "users:read")
	noAccess, _ := harness.staff("admin", "verification:review")
	queue := harness.expect("GET", "/api/v1/admin/business-documents", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(queue) != 1 || queue[0].(map[string]any)["overallStatus"] != "PENDING" || len(queue[0].(map[string]any)["documents"].([]any)) != 3 {
		t.Fatalf("unexpected queue %v", queue)
	}
	submission := queue[0].(map[string]any)
	submissionId := submission["id"].(string)
	documents := submission["documents"].([]any)
	first := documents[0].(map[string]any)["id"].(string)
	harness.expect("GET", "/api/v1/admin/business-documents/"+submissionId+"/documents/"+first+"/access", noAccess, nil, http.StatusForbidden)
	access := harness.expect("GET", "/api/v1/admin/business-documents/"+submissionId+"/documents/"+first+"/access", reviewer, nil, http.StatusOK)
	if !strings.Contains(access["watermarkText"].(string), "confidential") || access["viewUrl"] == nil {
		t.Fatalf("unexpected access %v", access)
	}
	if !harness.audit.has("business_document.viewed") {
		t.Fatal("opening a document must be audited")
	}
	rejected := harness.expect("POST", "/api/v1/admin/business-documents/"+submissionId+"/documents/"+first+"/reject", reviewer, map[string]string{"reason": "The certificate is blurry"}, http.StatusOK)
	if rejected["overallStatus"] != "REJECTED" {
		t.Fatalf("unexpected %v", rejected)
	}
	mine := harness.expect("GET", "/api/v1/seller/business-documents", token, nil, http.StatusOK)["documents"].([]any)
	if mine[0].(map[string]any)["status"] != "rejected" || mine[0].(map[string]any)["rejectionReason"] != "The certificate is blurry" {
		t.Fatalf("the seller sees the rejection reason: %v", mine)
	}
	harness.expect("POST", "/api/v1/admin/business-documents/"+submissionId+"/documents/"+first+"/approve", reviewer, map[string]string{"reason": "looks fine to me"}, http.StatusConflict)

	intent := harness.expect("POST", "/api/v1/seller/business-documents/cac_certificate/upload-intents", token, map[string]any{"fileName": "cac2.pdf", "contentType": "application/pdf", "sizeBytes": 2048}, http.StatusCreated)
	storage.markUploaded(intent["objectKey"].(string))
	harness.expect("PUT", "/api/v1/seller/business-documents/cac_certificate", token, map[string]any{"documentId": intent["documentId"]}, http.StatusOK)
	queue = harness.expect("GET", "/api/v1/admin/business-documents", reviewer, nil, http.StatusOK)["data"].([]any)
	var last map[string]any
	for _, document := range queue[0].(map[string]any)["documents"].([]any) {
		last = harness.expect("POST", "/api/v1/admin/business-documents/"+submissionId+"/documents/"+document.(map[string]any)["id"].(string)+"/approve", reviewer, map[string]string{"reason": "document is valid"}, http.StatusOK)
	}
	if last["overallStatus"] != "APPROVED" || last["goldCheckmark"] != "WAITING_FOR_PLAN" {
		t.Fatalf("on the free plan Gold waits for a paid plan: %v", last)
	}
	harness.putSignals(storeId, map[string]any{"sellerPlan": "PRO"})
	after := harness.expect("GET", "/api/v1/admin/business-documents?status=APPROVED", reviewer, nil, http.StatusOK)["data"].([]any)
	if len(after) != 1 || after[0].(map[string]any)["goldCheckmark"] != "GRANTED" {
		t.Fatalf("approval plus a paid plan grants Gold: %v", after)
	}
	harness.waitForPublishedEvents("sellerDocuments.submitted", "sellerDocuments.rejected", "sellerDocuments.approved", "businessVerification.approved")
	if strings.Contains(strings.Join(harness.publisher.PublishedEventTypes(), ","), "businessVerification.revoked") {
		t.Fatal("rejecting a document before the first approval is not a revocation")
	}
	approvedDocument := after[0].(map[string]any)["documents"].([]any)[0].(map[string]any)["id"].(string)
	revoked := harness.expect("POST", "/api/v1/admin/business-documents/"+submissionId+"/documents/"+approvedDocument+"/reject", reviewer, map[string]string{"reason": "The CAC registration was struck off"}, http.StatusOK)
	if revoked["overallStatus"] != "REJECTED" {
		t.Fatalf("revoking an approved document leaves the business unverified: %v", revoked)
	}
	harness.expect("POST", "/api/v1/admin/business-documents/"+submissionId+"/documents/"+approvedDocument+"/reject", reviewer, map[string]string{"reason": "The CAC registration was struck off"}, http.StatusConflict)
	harness.waitForPublishedEvents("businessVerification.revoked")
}

func TestLegalVersionsMakerCheckerNoticesAndAcceptance(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	_, userToken := harness.newAccount("reader.one", "Reader One")
	author, authorStepUp := harness.staff("admin", "legal.documents.view", "legal.documents.edit", "legal.documents.publish", "legal.notices.send")
	publisher, publisherStepUp := harness.staff("admin", "legal.documents.view", "legal.documents.publish", "legal.notices.send")
	viewer, _ := harness.staff("admin", "legal.documents.view")
	harness.expect("GET", "/api/v1/admin/legal/documents", userToken, nil, http.StatusUnauthorized)
	documents := harness.expect("GET", "/api/v1/admin/legal/documents", viewer, nil, http.StatusOK)["items"].([]any)
	if len(documents) != 8 {
		t.Fatalf("eight legal documents are seeded: %v", documents)
	}

	body := map[string]any{"bodyMarkdown": "# Terms\n\nBe kind.", "changeSummary": "Plain language rewrite", "isMaterialChange": true}
	harness.expect("POST", "/api/v1/admin/legal/documents/terms/versions", viewer, body, http.StatusForbidden)
	draft := harness.expect("POST", "/api/v1/admin/legal/documents/terms/versions", author, body, http.StatusCreated)
	if draft["status"] != "DRAFT" || draft["isFlaggedForLegalReview"] != true || draft["versionNumber"] != float64(1) {
		t.Fatalf("a material change is flagged for legal review: %v", draft)
	}
	versionId := draft["id"].(string)
	harness.expect("POST", "/api/v1/admin/legal/documents/terms/versions", author, body, http.StatusConflict)
	harness.expect("PUT", "/api/v1/admin/legal/versions/"+versionId, author, map[string]any{"bodyMarkdown": "# Terms\n\nBe kind and honest.", "changeSummary": "Plain language rewrite", "isMaterialChange": true}, http.StatusOK)
	harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/publish", publisher, map[string]string{"reason": "legal approved"}, http.StatusForbidden)
	harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/publish", publisher, map[string]string{"reason": "legal approved"}, http.StatusConflict, publisherStepUp...)
	harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/submit", author, nil, http.StatusOK)
	harness.expect("PUT", "/api/v1/admin/legal/versions/"+versionId, author, map[string]any{"bodyMarkdown": "# Terms", "changeSummary": "x", "isMaterialChange": false}, http.StatusConflict)
	harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/return", viewer, map[string]string{"reason": "needs another pass"}, http.StatusForbidden)

	sameAdmin := harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/publish", author, map[string]string{"reason": "legal approved"}, http.StatusConflict, authorStepUp...)
	if sameAdmin["code"] != "SAME_ADMIN" {
		t.Fatalf("the author or submitter can never publish: %v", sameAdmin)
	}
	published := harness.expect("POST", "/api/v1/admin/legal/versions/"+versionId+"/publish", publisher, map[string]string{"reason": "legal approved"}, http.StatusOK, publisherStepUp...)
	if published["noticeId"] == nil || published["version"].(map[string]any)["status"] != "PUBLISHED" {
		t.Fatalf("publishing a material terms change queues the notice: %v", published)
	}
	harness.waitForPublishedEvents("policy.published", "policyVersion.published")
	noticeId := published["noticeId"].(string)
	harness.expect("PUT", "/api/v1/internal/legal/notices/"+noticeId+"/progress", "", map[string]any{"status": "completed", "sentCount": 1, "excludedHardBounces": 0, "excludedSuppressed": 0, "batchesDone": 1}, http.StatusOK, internalToken...)
	harness.expect("GET", "/api/v1/admin/legal/notices/"+noticeId, publisher, nil, http.StatusNotFound)

	current := harness.expect("GET", "/api/v1/legal/policy-versions/current", "", nil, http.StatusOK)["items"].([]any)
	if len(current) != 1 || current[0].(map[string]any)["policyVersionId"] != versionId || current[0].(map[string]any)["isMaterialChange"] != true {
		t.Fatalf("unexpected current versions %v", current)
	}
	acceptance := harness.expect("GET", "/api/v1/admin/legal/versions/"+versionId+"/acceptance", viewer, nil, http.StatusOK)
	if acceptance["mustAcceptBy"] == nil || acceptance["acceptedCount"] != float64(0) {
		t.Fatalf("unexpected acceptance %v", acceptance)
	}
	harness.expect("PUT", "/api/v1/users/me/consents", userToken, map[string]any{"policyVersionId": "00000000-0000-0000-0000-000000000000", "consents": map[string]bool{}}, http.StatusUnprocessableEntity)
	harness.expect("PUT", "/api/v1/users/me/consents", userToken, map[string]any{"policyVersionId": versionId, "consents": map[string]bool{}}, http.StatusOK)
	accepted := harness.expect("GET", "/api/v1/users/me/policy-acceptances", userToken, nil, http.StatusOK)["acceptedPolicyVersionIds"].([]any)
	if len(accepted) != 1 || accepted[0] != versionId {
		t.Fatalf("the acceptance record links the policy version: %v", accepted)
	}

	next := harness.expect("POST", "/api/v1/admin/legal/documents/terms/rollback", author, map[string]any{"fromVersionId": versionId, "reason": "revert the rewrite"}, http.StatusCreated)
	if next["status"] != "DRAFT" || next["rolledBackFromVersionNumber"] != float64(1) || next["versionNumber"] != float64(2) {
		t.Fatalf("rollback creates a new draft and never rewrites history: %v", next)
	}
}

func TestContactPrivacySettingsAreServerValidatedAndReadableByServices(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("privacy.person", "Privacy Person")
	if initial := harness.expect("GET", "/api/v1/users/me/mention-privacy", token, nil, http.StatusOK); initial["whoCanMentionMe"] != "everyone" {
		t.Fatalf("unexpected default %v", initial)
	}
	harness.expect("PUT", "/api/v1/users/me/mention-privacy", token, map[string]string{"whoCanMentionMe": "followers"}, http.StatusBadRequest)
	harness.expect("PUT", "/api/v1/users/me/message-privacy", token, map[string]string{"whoCanMessageMe": "everyone-ish"}, http.StatusBadRequest)
	harness.expect("PUT", "/api/v1/users/me/mention-privacy", token, map[string]string{"whoCanMentionMe": "no_one"}, http.StatusOK)
	harness.expect("PUT", "/api/v1/users/me/message-privacy", token, map[string]string{"whoCanMessageMe": "followers"}, http.StatusOK)
	harness.expect("PATCH", "/api/v1/users/me", token, map[string]any{"isPrivate": true}, http.StatusOK)
	internal := harness.expect("GET", "/api/v1/internal/accounts/"+accountId+"/contact-privacy", "", nil, http.StatusOK, internalToken...)
	if internal["whoCanMentionMe"] != "no_one" || internal["whoCanMessageMe"] != "followers" || internal["isPrivateProfile"] != true {
		t.Fatalf("services read the settings from the owner: %v", internal)
	}
	harness.expect("GET", "/api/v1/internal/accounts/"+accountId+"/contact-privacy", "", nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/users/me/mention-privacy", "", nil, http.StatusUnauthorized)
	harness.waitForPublishedEvents("privacy.contactSettingsChanged")
}

func TestNotificationDirectoryServesRecipientsAudienceAndUnsubscribe(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	firstId, firstToken := harness.newAccount("mail.one", "Mail One")
	_, secondToken := harness.newAccount("mail.two", "Mail Two")
	harness.expect("GET", "/api/v1/users/me", firstToken, nil, http.StatusOK)
	harness.expect("GET", "/api/v1/users/me", secondToken, nil, http.StatusOK)
	harness.expect("PUT", "/api/v1/users/me/consents", firstToken, map[string]any{"policyVersion": "1.0", "decisions": map[string]bool{"marketing": true}}, http.StatusOK)

	recipient := harness.expect("GET", "/api/v1/internal/users/"+firstId+"/notification-recipient", "", nil, http.StatusOK, internalToken...)
	if recipient["firstName"] != "Mail" || recipient["marketingConsent"] != true || recipient["emailVerified"] != true || recipient["email"] != "mail.one@example.com" {
		t.Fatalf("unexpected recipient %v", recipient)
	}
	if recipient["pushEnabled"] != true || recipient["marketingFrequency"] != "weekly" {
		t.Fatalf("recipient carries push and marketing frequency settings: %v", recipient)
	}
	harness.expect("GET", "/api/v1/internal/users/"+firstId+"/notification-recipient", "", nil, http.StatusUnauthorized)
	byName := harness.expect("GET", "/api/v1/internal/users/by-username/mail.two/notification-recipient", "", nil, http.StatusOK, internalToken...)
	if byName["marketingConsent"] != false {
		t.Fatalf("unexpected %v", byName)
	}
	harness.expect("GET", "/api/v1/internal/users/by-username/nobody.here/notification-recipient", "", nil, http.StatusNotFound, internalToken...)
	count := harness.expect("GET", "/api/v1/internal/notification-audience/all-users/count", "", nil, http.StatusOK, internalToken...)
	if count["total"] != float64(2) || count["marketingConsentCount"] != float64(1) {
		t.Fatalf("unexpected count %v", count)
	}
	page := harness.expect("GET", "/api/v1/internal/notification-audience/all-users?limit=1", "", nil, http.StatusOK, internalToken...)
	if len(page["data"].([]any)) != 1 || page["nextCursor"] == nil {
		t.Fatalf("audiences are paged: %v", page)
	}
	if segments := harness.expect("GET", "/api/v1/internal/notification-audience/segments", "", nil, http.StatusOK, internalToken...); len(segments["data"].([]any)) < 3 {
		t.Fatalf("unexpected segments %v", segments)
	}
	harness.expect("GET", "/api/v1/internal/notification-audience/unknown-segment/count", "", nil, http.StatusNotFound, internalToken...)
	harness.expect("POST", "/api/v1/internal/users/"+firstId+"/marketing-unsubscribe", "", nil, http.StatusOK, internalToken...)
	after := harness.expect("GET", "/api/v1/internal/users/"+firstId+"/notification-recipient", "", nil, http.StatusOK, internalToken...)
	if after["marketingConsent"] != false {
		t.Fatalf("an unsubscribe withdraws the marketing consent: %v", after)
	}
}
