package updatecontactprivacy

import (
	"context"
	"slices"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/privacysetting"
	privacyevents "zudomart/modules/users/src/modules/contactPrivacy/events"
	"zudomart/modules/users/src/modules/contactPrivacy/services"
)

var messageAudiences = []string{"everyone", "following", "followers", "nobody"}
var mentionAudiences = []string{"everyone", "following", "no_one"}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.ContactPrivacy, error) {
	if command.WhoCanMessage != nil && !slices.Contains(messageAudiences, *command.WhoCanMessage) {
		return services.ContactPrivacy{}, usersErrors.ValidationFailedFor("whoCanMessageMe", "must be everyone, following, followers or nobody")
	}
	if command.WhoCanMention != nil && !slices.Contains(mentionAudiences, *command.WhoCanMention) {
		return services.ContactPrivacy{}, usersErrors.ValidationFailedFor("whoCanMentionMe", "must be everyone, following or no_one")
	}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.PrivacySetting.Query().Where(privacysetting.AccountID(command.AccountId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			row, err = tx.PrivacySetting.Create().SetAccountID(command.AccountId).Save(ctx)
		}
		if err != nil {
			return err
		}
		update := row.Update()
		if command.WhoCanMessage != nil {
			update.SetWhoCanMessageMe(privacysetting.WhoCanMessageMe(*command.WhoCanMessage))
		}
		if command.WhoCanMention != nil {
			update.SetWhoCanMentionMe(privacysetting.WhoCanMentionMe(*command.WhoCanMention))
		}
		saved, err := update.Save(ctx)
		if err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, privacyevents.ContactPrivacyChangedType, command.AccountId.String(), handler.Container.Now(), privacyevents.ContactPrivacyChangedData{
			AccountId: command.AccountId.String(), WhoCanMessage: string(saved.WhoCanMessageMe), WhoCanMention: string(saved.WhoCanMentionMe),
		})
	})
	if err != nil {
		return services.ContactPrivacy{}, err
	}
	return services.LoadContactPrivacy(ctx, handler.Container.Client, command.AccountId)
}
