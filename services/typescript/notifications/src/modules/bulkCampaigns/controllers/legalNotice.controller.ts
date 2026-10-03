import type { Container } from "../../../container.js";
import { requireAnyPermission, requireStepUp } from "../../../middlewares/staffAuth.middleware.js";
import type { RouteContext } from "../../../types/route.type.js";
import { json, readJsonBody } from "../../../utils/http.util.js";
import { parseWithSchema } from "../../inbox/validators/inbox.validator.js";
import { queueLegalNoticeBodySchema, updateNoticeDraftBodySchema } from "../validators/adminEmail.validator.js";

const viewPermissions = ["legal.documents.view", "legal.notices.send"] as const;
const editPermissions = ["legal.documents.edit", "legal.notices.send"] as const;

export class LegalNoticeController {
  public constructor(private readonly container: Container) {}

  private async staff(context: RouteContext, permissions: readonly string[]) {
    const staff = await this.container.staffAuthenticator.authenticate(context.request);
    requireAnyPermission(staff, permissions);
    return staff;
  }

  public getDraft = async (context: RouteContext) => {
    await this.staff(context, viewPermissions);
    return json(200, await this.container.getNoticeDraft.execute(context.params["versionId"] ?? ""));
  };

  public updateDraft = async (context: RouteContext) => {
    const staff = await this.staff(context, editPermissions);
    const body = parseWithSchema(updateNoticeDraftBodySchema, readJsonBody(context.request));
    return json(200, await this.container.updateNoticeDraft.execute({ versionId: context.params["versionId"] ?? "", ...body, actor: { id: staff.id, name: staff.name } }));
  };

  public testSend = async (context: RouteContext) => {
    const staff = await this.staff(context, editPermissions);
    return json(200, await this.container.sendNoticeTestEmail.execute({ versionId: context.params["versionId"] ?? "", actor: { id: staff.id, name: staff.name } }));
  };

  public preview = async (context: RouteContext) => {
    await this.staff(context, viewPermissions);
    return json(200, await this.container.previewLegalNotice.execute(context.params["versionId"] ?? ""));
  };

  public listNotices = async (context: RouteContext) => {
    await this.staff(context, viewPermissions);
    return json(200, await this.container.listLegalNotices.list());
  };

  public getNotice = async (context: RouteContext) => {
    await this.staff(context, viewPermissions);
    return json(200, await this.container.listLegalNotices.get(context.params["noticeId"] ?? ""));
  };

  public queueNotice = async (context: RouteContext) => {
    const staff = await this.staff(context, ["legal.notices.send"]);
    requireStepUp(staff);
    const body = parseWithSchema(queueLegalNoticeBodySchema, readJsonBody(context.request));
    return json(201, await this.container.queueLegalNotice.execute({ ...body, actor: { id: staff.id, name: staff.name } }));
  };
}
