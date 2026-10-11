package createbusinessprofile

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/businesscategory"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
)

const maximumCategoriesPerProfile = 5

var slugCleaner = regexp.MustCompile(`[^a-z0-9]+`)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.ActingProfileView, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return types.ActingProfileView{}, usersErrors.ErrAccountUnavailable
	}
	name := strings.TrimSpace(command.DisplayName)
	if len([]rune(name)) < 2 || len([]rune(name)) > 80 || len([]rune(command.Description)) > 300 {
		return types.ActingProfileView{}, usersErrors.Unprocessable("Add your business name (2-80 characters) and a description of at most 300.")
	}
	if len(command.Categories) == 0 || len(command.Categories) > maximumCategoriesPerProfile {
		return types.ActingProfileView{}, usersErrors.Unprocessable("Pick between 1 and 5 categories.")
	}
	if command.Website != nil {
		if err := services.AssertImageUrlIsAllowed(handler.Container, *command.Website); err != nil {
			return types.ActingProfileView{}, usersErrors.Unprocessable("Enter a valid website link.")
		}
	}
	if _, _, err := services.EnsurePersonalProfile(ctx, handler.Container, owner); err != nil {
		return types.ActingProfileView{}, err
	}
	handle, verdict, err := services.JudgeUsername(ctx, handler.Container, command.Handle, owner, true)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	if !verdict.Available {
		return types.ActingProfileView{}, usersErrors.ErrHandleTaken
	}
	var created *ent.Profile
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		categoryIds, err := handler.resolveCategories(ctx, tx, owner, command.Categories)
		if err != nil {
			return err
		}
		builder := tx.Profile.Create().SetAccountID(owner).SetKind(profile.KindBusiness).SetProfileType(profile.ProfileType(businessTypeOf(command.BusinessType))).SetHandle(handle).SetDisplayName(name).SetBio(strings.TrimSpace(command.Description)).AddCategoryIDs(categoryIds...)
		if command.Website != nil {
			builder.SetWebsite(*command.Website)
		}
		if created, err = builder.Save(ctx); err != nil {
			return err
		}
		claim := services.LinkedClaim{AccountId: owner, Kind: services.LinkedKindForBusinessPurpose(command.Purpose, command.BusinessType), ProfileId: created.ID}
		if _, err = services.ClaimLinkedProfile(ctx, tx, claim); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "businessProfile.created", owner.String(), handler.Container.Now(), events.BusinessProfileCreatedEventData{
			AccountId: owner.String(), ProfileId: created.ID.String(), Handle: handle,
		})
	})
	if ent.IsConstraintError(err) && !isLimitError(err) {
		return types.ActingProfileView{}, usersErrors.ErrHandleTaken
	}
	if err != nil {
		return types.ActingProfileView{}, err
	}
	created, err = handler.Container.Client.Profile.Query().Where(profile.ID(created.ID)).WithCategories().Only(ctx)
	if err != nil {
		return types.ActingProfileView{}, err
	}
	return services.BuildLinkedActingProfileView(ctx, handler.Container, created, "")
}

func (handler Handler) resolveCategories(ctx context.Context, tx *ent.Tx, owner uuid.UUID, selections []CategorySelection) ([]uuid.UUID, error) {
	var resolved []uuid.UUID
	for _, selection := range selections {
		categoryId, err := handler.resolveSelection(ctx, tx, owner, selection)
		if err != nil {
			return nil, err
		}
		resolved = append(resolved, categoryId)
	}
	return resolved, nil
}

func (handler Handler) resolveSelection(ctx context.Context, tx *ent.Tx, owner uuid.UUID, selection CategorySelection) (uuid.UUID, error) {
	var parentId *uuid.UUID
	if selection.CategoryId != nil {
		parsed, err := uuid.Parse(*selection.CategoryId)
		if err != nil || !handler.categoryIsActive(ctx, tx, parsed) {
			return uuid.Nil, usersErrors.Unprocessable("Pick a valid category.")
		}
		parentId = &parsed
	}
	if selection.SubcategoryId != nil {
		parsed, err := uuid.Parse(*selection.SubcategoryId)
		child, lookupErr := tx.BusinessCategory.Query().Where(businesscategory.ID(parsed), businesscategory.StatusEQ(businesscategory.StatusActive)).Only(ctx)
		if err != nil || lookupErr != nil || (parentId != nil && (child.ParentID == nil || *child.ParentID != *parentId)) {
			return uuid.Nil, usersErrors.Unprocessable("Pick a valid subcategory.")
		}
		return child.ID, nil
	}
	if selection.CustomName != nil {
		return handler.createPendingCustomCategory(ctx, tx, owner, parentId, strings.TrimSpace(*selection.CustomName))
	}
	if parentId == nil {
		return uuid.Nil, usersErrors.Unprocessable("Pick a category or describe your own.")
	}
	return *parentId, nil
}

func (handler Handler) categoryIsActive(ctx context.Context, tx *ent.Tx, id uuid.UUID) bool {
	exists, err := tx.BusinessCategory.Query().Where(businesscategory.ID(id), businesscategory.StatusEQ(businesscategory.StatusActive)).Exist(ctx)
	return err == nil && exists
}

func (handler Handler) createPendingCustomCategory(ctx context.Context, tx *ent.Tx, owner uuid.UUID, parentId *uuid.UUID, name string) (uuid.UUID, error) {
	if len([]rune(name)) < 2 || len([]rune(name)) > 60 {
		return uuid.Nil, usersErrors.Unprocessable("Custom categories are 2-60 characters.")
	}
	slug := strings.Trim(slugCleaner.ReplaceAllString(strings.ToLower(name), "-"), "-")
	builder := tx.BusinessCategory.Create().SetName(name).SetSlug("custom-" + slug + "-" + uuid.NewString()[:8]).SetStatus(businesscategory.StatusPendingReview).SetCreatedByAccountID(owner)
	if parentId != nil {
		builder.SetParentID(*parentId)
	}
	created, err := builder.Save(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	return created.ID, nil
}

func businessTypeOf(requested string) string {
	if requested == "brand" || requested == "government" {
		return requested
	}
	return "business"
}

func isLimitError(err error) bool {
	return errors.Is(err, usersErrors.ErrProfileLimitStoreOrBusiness) || errors.Is(err, usersErrors.ErrProfileLimitOneBrand)
}
