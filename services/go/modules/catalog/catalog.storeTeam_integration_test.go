package catalog

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	catalogerrors "nantty/modules/catalog/src/errors"
	addstaffmember "nantty/modules/catalog/src/modules/storeTeam/commands/addStaffMember"
	removestaffmember "nantty/modules/catalog/src/modules/storeTeam/commands/removeStaffMember"
	respondtoteamrequest "nantty/modules/catalog/src/modules/storeTeam/commands/respondToTeamRequest"
	updatestaffmember "nantty/modules/catalog/src/modules/storeTeam/commands/updateStaffMember"
	"nantty/modules/catalog/src/modules/storeTeam/dtos"
	listauditlog "nantty/modules/catalog/src/modules/storeTeam/queries/listAuditLog"
	liststaff "nantty/modules/catalog/src/modules/storeTeam/queries/listStaff"
	listteamrequests "nantty/modules/catalog/src/modules/storeTeam/queries/listTeamRequests"
	searchnanttyusers "nantty/modules/catalog/src/modules/storeTeam/queries/searchNanttyUsers"
	"nantty/modules/catalog/src/services"
	"nantty/platform/sellerplans"
)

func TestStaffAreInvitedAcceptInTheAppAndEveryChangeIsAudited(t *testing.T) {
	fixture := startTeamFixture(t)
	ctx := context.Background()
	deployed := fixture.module.Container
	owner := services.StoreActor{AccountId: fixture.ownerId, Name: "Adaowner", Role: "owner"}
	tolu := fixture.directory.add("tolusales")
	add := addstaffmember.Handler{Container: deployed}
	request := dtos.CreateStaffRequest{UserId: tolu.String(), Role: "sales", LocationIds: []string{fixture.location.String()}}

	if _, err := add.Execute(ctx, addstaffmember.Command{Store: fixture.ownerAccess(), Actor: owner, Plan: sellerplans.Free, Request: request}); !errors.Is(err, catalogerrors.SeatLimitReached) {
		t.Fatalf("free plan has no seats, got %v", err)
	}
	member, err := add.Execute(ctx, addstaffmember.Command{Store: fixture.ownerAccess(), Actor: owner, Plan: sellerplans.Pro, Request: request})
	if err != nil || member.Status != "invited" || member.Username != "tolusales" {
		t.Fatalf("invite: %+v %v", member, err)
	}
	if _, err := add.Execute(ctx, addstaffmember.Command{Store: fixture.ownerAccess(), Actor: owner, Plan: sellerplans.Pro, Request: request}); !errors.Is(err, catalogerrors.StaffExists) {
		t.Fatalf("duplicate invite: %v", err)
	}
	if _, found, _ := services.FindStoreAccess(ctx, deployed, tolu, &fixture.store.ID); found {
		t.Fatal("an invited member must not reach the dashboard before accepting")
	}
	candidates, _ := searchnanttyusers.Handler{Container: deployed}.Execute(ctx, searchnanttyusers.Query{Store: fixture.ownerAccess(), CallerId: fixture.ownerId, Text: "tolu", ExcludeTeam: true})
	if len(candidates.Data) != 0 {
		t.Fatalf("candidates must exclude the team: %+v", candidates.Data)
	}

	requests, _ := listteamrequests.Handler{Container: deployed}.Execute(ctx, listteamrequests.Query{AccountId: tolu})
	if len(requests.Data) != 1 || requests.Data[0].StoreName != "Ada Fabrics" {
		t.Fatalf("team requests: %+v", requests.Data)
	}
	stranger := services.StoreActor{AccountId: uuid.New()}
	memberId := uuid.MustParse(member.Id)
	if err := (respondtoteamrequest.Handler{Container: deployed}).Execute(ctx, respondtoteamrequest.Command{Actor: stranger, MemberId: memberId, Accept: true}); !errors.Is(err, catalogerrors.TeamRequestNotFound) {
		t.Fatalf("only the invitee may accept: %v", err)
	}
	if err := (respondtoteamrequest.Handler{Container: deployed}).Execute(ctx, respondtoteamrequest.Command{Actor: services.StoreActor{AccountId: tolu, Name: "Tolusales"}, MemberId: memberId, Accept: true}); err != nil {
		t.Fatal(err)
	}
	access, found, err := services.FindStoreAccess(ctx, deployed, tolu, &fixture.store.ID)
	if err != nil || !found || access.Role != "sales" || !access.Allows("orders:manage") || access.Allows("wallet:view") {
		t.Fatalf("accepted member access: %+v %v %v", access, found, err)
	}

	update := updatestaffmember.Handler{Container: deployed}
	salesActor := services.StoreActor{AccountId: tolu, Role: "sales"}
	if _, err := update.Execute(ctx, updatestaffmember.Command{Store: access, Actor: salesActor, Plan: sellerplans.Pro, MemberId: memberId, Request: dtos.UpdateStaffRequest{Status: pointer("suspended")}}); !errors.Is(err, catalogerrors.CannotEditSelf) {
		t.Fatalf("self edit: %v", err)
	}
	ownerRow, _ := liststaff.Handler{Container: deployed}.Execute(ctx, liststaff.Query{Store: fixture.ownerAccess(), Text: "adaowner", Limit: 10})
	if len(ownerRow.Data) != 1 || ownerRow.Data[0].Role != "owner" {
		t.Fatalf("owner row: %+v", ownerRow.Data)
	}
	managerAccess := fixture.ownerAccess()
	managerAccess.Role = "manager"
	if _, err := update.Execute(ctx, updatestaffmember.Command{Store: managerAccess, Actor: services.StoreActor{AccountId: uuid.New(), Role: "manager"}, Plan: sellerplans.Pro, MemberId: uuid.MustParse(ownerRow.Data[0].Id), Request: dtos.UpdateStaffRequest{Status: pointer("suspended")}}); !errors.Is(err, catalogerrors.OwnerProtected) {
		t.Fatalf("owner protected: %v", err)
	}
	if _, err := update.Execute(ctx, updatestaffmember.Command{Store: managerAccess, Actor: services.StoreActor{AccountId: uuid.New(), Role: "manager"}, Plan: sellerplans.Pro, MemberId: memberId, Request: dtos.UpdateStaffRequest{Role: pointer("manager")}}); !errors.Is(err, catalogerrors.OwnerOnly) {
		t.Fatalf("only the owner grants manager: %v", err)
	}
	suspended, err := update.Execute(ctx, updatestaffmember.Command{Store: fixture.ownerAccess(), Actor: owner, Plan: sellerplans.Pro, MemberId: memberId, Request: dtos.UpdateStaffRequest{Status: pointer("suspended"), Permissions: dtos.NullableList{Present: true, Values: []string{"orders:view"}}}})
	if err != nil || suspended.Status != "suspended" || len(suspended.Permissions) != 1 {
		t.Fatalf("suspend: %+v %v", suspended, err)
	}
	if _, found, _ := services.FindStoreAccess(ctx, deployed, tolu, &fixture.store.ID); found {
		t.Fatal("a suspended member loses access on the next request")
	}
	if err := (removestaffmember.Handler{Container: deployed}).Execute(ctx, removestaffmember.Command{Store: fixture.ownerAccess(), Actor: owner, MemberId: memberId}); err != nil {
		t.Fatal(err)
	}

	log, err := listauditlog.Handler{Container: deployed}.Execute(ctx, listauditlog.Query{Store: fixture.ownerAccess(), ActionPrefix: "staff.", Limit: 2})
	if err != nil || len(log.Data) != 2 || log.Data[0].Action != "staff.removed" || log.Data[1].Action != "staff.updated" || log.NextCursor == nil {
		t.Fatalf("audit page one: %+v %v", log, err)
	}
	rest, _ := listauditlog.Handler{Container: deployed}.Execute(ctx, listauditlog.Query{Store: fixture.ownerAccess(), ActionPrefix: "staff.", Cursor: *log.NextCursor, Limit: 10})
	if len(rest.Data) != 2 || rest.Data[0].Action != "staff.joined" || rest.Data[1].Action != "staff.invited" {
		t.Fatalf("audit page two: %+v", rest.Data)
	}
	if count, _ := deployed.Client.OutboxEvent.Query().Count(ctx); count < 4 {
		t.Fatalf("team changes must enqueue outbox events, got %d", count)
	}
}

func pointer[Value any](value Value) *Value { return &value }
