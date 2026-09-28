import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { CreateCategoryCommand } from "../commands/createCategory/createCategory.command.js";
import { DeleteCategoryCommand } from "../commands/deleteCategory/deleteCategory.command.js";
import { UpdateCategoryCommand } from "../commands/updateCategory/updateCategory.command.js";
import { convertCategoryToDto } from "../dtos/categories.dto.js";
import type { CategoryRecord } from "../models/categories.model.js";
import { GetCategoryQuery } from "../queries/getCategory/getCategory.query.js";
import { ListCategoriesQuery } from "../queries/listCategories/listCategories.query.js";
import { CategoryParamsSchema, CreateCategoryBodySchema, UpdateCategoryBodySchema } from "../validators/categories.validator.js";

export class CategoriesController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly list = async (): Promise<HttpResponseContext> => {
    const categories = await this.queries.execute<ListCategoriesQuery, readonly CategoryRecord[]>(new ListCategoriesQuery());
    return json(200, { items: categories.map(convertCategoryToDto) });
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CategoryParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const category = await this.queries.execute<GetCategoryQuery, CategoryRecord>(new GetCategoryQuery(params.data.id));
    return json(200, convertCategoryToDto(category));
  };

  public readonly create = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateCategoryBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CreateCategoryCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, convertCategoryToDto(await this.commands.execute<CreateCategoryCommand, CategoryRecord>(command)));
  };

  public readonly update = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CategoryParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateCategoryBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateCategoryCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, convertCategoryToDto(await this.commands.execute<UpdateCategoryCommand, CategoryRecord>(command)));
  };

  public readonly remove = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CategoryParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<DeleteCategoryCommand, void>(new DeleteCategoryCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };
}
