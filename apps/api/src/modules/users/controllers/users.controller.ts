import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { UNVERIFIED_PERSONAL_BADGE, type VerificationBadge, type VerificationBadgeLookup } from "../../../interfaces/verificationBadge.interface.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { AddAddressCommand } from "../commands/addAddress/addAddress.command.js";
import { DeactivateAccountCommand } from "../commands/deactivateAccount/deactivateAccount.command.js";
import { RemoveAddressCommand } from "../commands/removeAddress/removeAddress.command.js";
import { SaveTopicsCommand } from "../commands/saveTopics/saveTopics.command.js";
import { UpdateAddressCommand } from "../commands/updateAddress/updateAddress.command.js";
import { UpdatePreferencesCommand } from "../commands/updatePreferences/updatePreferences.command.js";
import { UpdateProfileCommand } from "../commands/updateProfile/updateProfile.command.js";
import { convertTopicToDto, convertUserToCurrentUserDto, convertUserToPublicUserDto, type AddressDto } from "../dtos/users.dto.js";
import type { TopicRecord, UserRecord } from "../models/users.model.js";
import { GetMeQuery } from "../queries/getMe/getMe.query.js";
import { GetUserQuery } from "../queries/getUser/getUser.query.js";
import { ListAddressesQuery } from "../queries/listAddresses/listAddresses.query.js";
import { ListMyTopicsQuery } from "../queries/listMyTopics/listMyTopics.query.js";
import { ListTopicsQuery } from "../queries/listTopics/listTopics.query.js";
import {
  AddressBodySchema,
  IdParamsSchema,
  SaveTopicsBodySchema,
  UpdateAddressBodySchema,
  UpdateLocalePreferencesBodySchema,
  UpdateProfileBodySchema,
  UpdateSettingsBodySchema,
  UsernameParamsSchema,
} from "../validators/users.validator.js";

export class UsersController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus, private readonly verificationBadges?: VerificationBadgeLookup) {}

  public readonly getMe = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const user = await this.queries.execute<GetMeQuery, UserRecord>(new GetMeQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, { ...convertUserToCurrentUserDto(user), verification: await this.findVerification(user.id) });
  };

  public readonly updateMe = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = UpdateProfileBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateProfileCommand(requireAuthenticatedPrincipal(ctx), body.data);
    const user = await this.commands.execute<UpdateProfileCommand, UserRecord>(command);
    return json(200, { ...convertUserToCurrentUserDto(user), verification: await this.findVerification(user.id) });
  };

  public readonly getSettings = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const user = await this.queries.execute<GetMeQuery, UserRecord>(new GetMeQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, user.settings);
  };

  public readonly updateSettings = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = UpdateSettingsBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdatePreferencesCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(200, (await this.commands.execute<UpdatePreferencesCommand, UserRecord>(command)).settings);
  };

  public readonly updateLocalePreferences = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = UpdateLocalePreferencesBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdatePreferencesCommand(requireAuthenticatedPrincipal(ctx), body.data);
    const { countryCode, currency } = (await this.commands.execute<UpdatePreferencesCommand, UserRecord>(command)).settings;
    return json(200, { countryCode, currency });
  };

  public readonly deactivate = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    await this.commands.execute<DeactivateAccountCommand, void>(new DeactivateAccountCommand(requireAuthenticatedPrincipal(ctx)));
    return empty(204);
  };

  public readonly listTopics = async (): Promise<HttpResponseContext> => {
    const topics = await this.queries.execute<ListTopicsQuery, readonly TopicRecord[]>(new ListTopicsQuery());
    return json(200, topics.map(convertTopicToDto));
  };

  public readonly listMyTopics = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const topics = await this.queries.execute<ListMyTopicsQuery, readonly TopicRecord[]>(new ListMyTopicsQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, topics.map(convertTopicToDto));
  };

  public readonly saveMyTopics = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = SaveTopicsBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SaveTopicsCommand(requireAuthenticatedPrincipal(ctx), body.data.topicIds);
    const topics = await this.commands.execute<SaveTopicsCommand, readonly TopicRecord[]>(command);
    return json(200, topics.map(convertTopicToDto));
  };

  public readonly listAddresses = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const addresses = await this.queries.execute<ListAddressesQuery, readonly AddressDto[]>(new ListAddressesQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, addresses);
  };

  public readonly addAddress = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = AddressBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new AddAddressCommand(requireAuthenticatedPrincipal(ctx), body.data);
    return json(201, await this.commands.execute<AddAddressCommand, AddressDto>(command));
  };

  public readonly updateAddress = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateAddressBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateAddressCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, await this.commands.execute<UpdateAddressCommand, AddressDto>(command));
  };

  public readonly removeAddress = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<RemoveAddressCommand, void>(new RemoveAddressCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly getUserById = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = IdParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const user = await this.queries.execute<GetUserQuery, UserRecord>(new GetUserQuery({ id: params.data.id }));
    return json(200, { ...convertUserToPublicUserDto(user), verification: await this.findVerification(user.id) });
  };

  public readonly getUserByUsername = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = UsernameParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const user = await this.queries.execute<GetUserQuery, UserRecord>(new GetUserQuery({ username: params.data.username }));
    return json(200, { ...convertUserToPublicUserDto(user), verification: await this.findVerification(user.id) });
  };

  private async findVerification(userId: string): Promise<VerificationBadge> {
    return (await this.verificationBadges?.findVerificationBadges([userId]))?.get(userId) ?? UNVERIFIED_PERSONAL_BADGE;
  }
}
