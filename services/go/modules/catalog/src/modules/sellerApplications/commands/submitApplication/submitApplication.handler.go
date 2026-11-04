package submitapplication

import (
	"context"
	"log/slog"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/databases/schema"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/sellerapplication"
	"nantty/modules/catalog/src/interfaces"
	applicationservices "nantty/modules/catalog/src/modules/sellerApplications/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/secretbox"
)

var phoneDigits = regexp.MustCompile(`[^0-9+]`)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (applicationservices.MyApplication, error) {
	request := command.Request
	country, err := handler.Container.Users.PersonalProfileCountry(ctx, command.AccountId)
	if err != nil {
		return applicationservices.MyApplication{}, err
	}
	if !strings.EqualFold(strings.TrimSpace(country), "NG") {
		return applicationservices.MyApplication{}, catalogerrors.SellerMarketUnavailable
	}
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
	var claimed *uuid.UUID
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
		applicationId := schema.NewTimeOrderedUuid()
		if err := handler.Container.LinkedProfiles.Claim(ctx, command.AccountId, interfaces.LinkedClaim{Kind: "store", ProfileId: applicationId}); err != nil {
			return "", err
		}
		claimed = &applicationId
		created, err := handler.create(ctx, tx, command, chosen, applicationId)
		if err != nil {
			return "", err
		}
		return created.ID.String(), events.EnqueueOutboxEventInTransaction(ctx, tx, "sellerApplication.submitted", created.ID.String(), handler.Container.Now(), map[string]any{
			"applicationId": created.ID, "accountId": command.AccountId, "storeName": created.StoreName, "categoryId": created.CategoryID,
		})
	})
	if err != nil && claimed != nil {
		if releaseErr := handler.Container.LinkedProfiles.Release(ctx, command.AccountId, interfaces.LinkedClaim{Kind: "store", ProfileId: *claimed}); releaseErr != nil {
			handler.Container.Logger.Error("release linked store claim", slog.Any("error", releaseErr))
		}
	}
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

func (handler Handler) create(ctx context.Context, tx *ent.Tx, command Command, chosen *ent.Category, applicationId uuid.UUID) (*ent.SellerApplication, error) {
	request, key := command.Request, handler.Container.Settings.DataEncryptionKey
	enableLogistics := request.EnableLogistics != nil && *request.EnableLogistics
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
	return tx.SellerApplication.Create().SetID(applicationId).SetAccountID(command.AccountId).SetStoreName(strings.TrimSpace(request.StoreName)).SetCategoryID(chosen.ID).
		SetCategoryName(chosen.Name).SetDescription(strings.TrimSpace(request.Description)).SetPhoneSealed(phone).SetAddressLine(strings.TrimSpace(request.AddressLine)).
		SetCity(strings.TrimSpace(request.City)).SetState(strings.TrimSpace(request.State)).SetLogisticsEnabled(enableLogistics).SetIdentityDocumentType(request.IdentityDocument.DocumentType).
		SetIdentityDocumentNumberSealed(document).SetIdentityDocumentLast4(number[len(number)-4:]).SetIdentityDocumentPhotoURL(request.IdentityDocument.DocumentPhotoUrl).
		SetPayoutBankCode(request.PayoutAccount.BankCode).SetPayoutAccountNumberSealed(account).SetPayoutAccountLast4(request.PayoutAccount.AccountNumber[6:]).Save(ctx)
}
