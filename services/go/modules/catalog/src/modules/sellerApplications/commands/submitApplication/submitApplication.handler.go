package submitapplication

import (
	"context"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/generated/ent/sellerapplication"
	applicationservices "zudomart/modules/catalog/src/modules/sellerApplications/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/secretbox"
)

var phoneDigits = regexp.MustCompile(`[^0-9+]`)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (applicationservices.MyApplication, error) {
	request := command.Request
	categoryId := uuid.MustParse(request.CategoryId)
	chosen, err := handler.Container.Client.Category.Query().Where(category.ID(categoryId), category.StoreIDIsNil(), category.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		issues := utils.Issues{}
		issues.Add("categoryId", "Choose an active marketplace category.")
		return applicationservices.MyApplication{}, issues.AsError()
	}
	if err != nil {
		return applicationservices.MyApplication{}, err
	}
	scope := "sellerApplications.submit:" + command.AccountId.String()
	applicationId, err := container.RunIdempotently(ctx, handler.Container, scope, command.IdempotencyKey, container.FingerprintOfRequest(request), func(tx *ent.Tx) (string, error) {
		previous, err := tx.SellerApplication.Query().Where(sellerapplication.AccountID(command.AccountId), sellerapplication.StatusIn("pending", "approved")).First(ctx)
		if err == nil && previous.Status == "approved" {
			return "", catalogerrors.AlreadySeller
		}
		if err == nil {
			return "", catalogerrors.ApplicationPending
		}
		if !ent.IsNotFound(err) {
			return "", err
		}
		created, err := handler.create(ctx, tx, command, chosen)
		if err != nil {
			return "", err
		}
		return created.ID.String(), events.EnqueueOutboxEventInTransaction(ctx, tx, "sellerApplication.submitted", created.ID.String(), handler.Container.Now(), map[string]any{
			"applicationId": created.ID, "accountId": command.AccountId, "storeName": created.StoreName, "categoryId": created.CategoryID,
		})
	})
	if ent.IsConstraintError(err) {
		return applicationservices.MyApplication{}, catalogerrors.ApplicationPending
	}
	if err != nil {
		return applicationservices.MyApplication{}, err
	}
	row, err := handler.Container.Client.SellerApplication.Get(ctx, uuid.MustParse(applicationId))
	if err != nil {
		return applicationservices.MyApplication{}, err
	}
	return applicationservices.PresentMine(row), nil
}

func (handler Handler) create(ctx context.Context, tx *ent.Tx, command Command, chosen *ent.Category) (*ent.SellerApplication, error) {
	request, key := command.Request, handler.Container.Settings.DataEncryptionKey
	seal := func(text string) ([]byte, error) { return secretbox.SealWithAesGcm(key, []byte(text)) }
	phone, err := seal(phoneDigits.ReplaceAllString(request.Phone, ""))
	if err != nil {
		return nil, err
	}
	document, err := seal(strings.ToUpper(strings.TrimSpace(request.IdentityDocument.DocumentNumber)))
	if err != nil {
		return nil, err
	}
	account, err := seal(request.PayoutAccount.AccountNumber)
	if err != nil {
		return nil, err
	}
	number := request.IdentityDocument.DocumentNumber
	return tx.SellerApplication.Create().SetAccountID(command.AccountId).SetStoreName(strings.TrimSpace(request.StoreName)).SetCategoryID(chosen.ID).
		SetCategoryName(chosen.Name).SetDescription(strings.TrimSpace(request.Description)).SetPhoneSealed(phone).SetAddressLine(strings.TrimSpace(request.AddressLine)).
		SetCity(strings.TrimSpace(request.City)).SetState(strings.TrimSpace(request.State)).SetIdentityDocumentType(request.IdentityDocument.DocumentType).
		SetIdentityDocumentNumberSealed(document).SetIdentityDocumentLast4(number[len(number)-4:]).SetIdentityDocumentPhotoURL(request.IdentityDocument.DocumentPhotoUrl).
		SetPayoutBankCode(request.PayoutAccount.BankCode).SetPayoutAccountNumberSealed(account).SetPayoutAccountLast4(request.PayoutAccount.AccountNumber[6:]).Save(ctx)
}
