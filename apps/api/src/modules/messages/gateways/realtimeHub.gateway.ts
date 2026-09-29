import { rolesGrantPermission } from "../../../constants/permissions.constant.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { RealtimeEvent, RealtimePublisher } from "../../../interfaces/realtimePublisher.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import { CLOSE_CODES, RealtimeConnection, type RealtimeSocket } from "./realtimeConnection.gateway.js";

export interface RealtimeAuthenticator {
  authenticateWithAccessToken(accessToken: string): Promise<Principal | undefined>;
  authenticateWithTicket(ticket: string): Promise<Principal | undefined>;
}

export interface RealtimeClientEvents {
  handleTypingSignal(principal: Principal, conversationId: string, isTyping: boolean): Promise<void>;
}

export interface RealtimeHubOptions {
  readonly maximumConnectionsPerUser: number;
  readonly maximumBufferedBytes: number;
  readonly heartbeatSeconds: number;
  readonly authenticationTimeoutSeconds: number;
  readonly maximumClientMessagesPerMinute: number;
  readonly maximumClientMessageBytes: number;
}

interface ClientMessage {
  readonly type?: unknown;
  readonly accessToken?: unknown;
  readonly ticket?: unknown;
  readonly conversationId?: unknown;
  readonly isTyping?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RealtimeHub implements RealtimePublisher {
  private readonly connectionsByUser = new Map<string, Set<RealtimeConnection>>();
  private readonly allConnections = new Set<RealtimeConnection>();
  private nextConnectionId = 1;

  public constructor(
    private readonly authenticator: RealtimeAuthenticator,
    private readonly clientEvents: RealtimeClientEvents,
    private readonly clock: Clock,
    private readonly logger: AppLogger,
    private readonly options: RealtimeHubOptions,
  ) {}

  public acceptSocket(socket: RealtimeSocket): RealtimeConnection {
    const connection = new RealtimeConnection(this.nextConnectionId++, socket, this.clock.now().getTime());
    this.allConnections.add(connection);
    return connection;
  }

  public async receiveText(connection: RealtimeConnection, text: string): Promise<void> {
    if (connection.state === "closed") return;
    const now = this.clock.now().getTime();
    if (!connection.recordIncomingMessage(now, 60_000, this.options.maximumClientMessagesPerMinute)) {
      this.closeConnection(connection, CLOSE_CODES.tooManyMessages, "Too many messages");
      return;
    }
    const message = text.length > this.options.maximumClientMessageBytes ? undefined : this.parseClientMessage(text);
    if (message === undefined) return this.sendDirect(connection, { type: "error", code: "INVALID_MESSAGE" });
    if (connection.state !== "open") return this.authenticate(connection, message);
    if (message.type === "ping") return this.sendDirect(connection, { type: "pong" });
    if (message.type === "typing" && typeof message.conversationId === "string" && UUID_PATTERN.test(message.conversationId)) {
      const principal = connection.principal;
      if (principal === undefined) return;
      await this.clientEvents.handleTypingSignal(principal, message.conversationId, message.isTyping === true).catch(() => undefined);
      return;
    }
    if (message.type === "auth") return;
    this.sendDirect(connection, { type: "error", code: "UNSUPPORTED_MESSAGE" });
  }

  public markAlive(connection: RealtimeConnection): void {
    connection.markAlive(this.clock.now().getTime());
  }

  public releaseConnection(connection: RealtimeConnection): void {
    connection.state = "closed";
    this.allConnections.delete(connection);
    const userId = connection.principal?.userId;
    if (userId === undefined) return;
    const userConnections = this.connectionsByUser.get(userId);
    userConnections?.delete(connection);
    if (userConnections?.size === 0) this.connectionsByUser.delete(userId);
  }

  public publishToUser(userId: string, event: RealtimeEvent): void {
    const connections = this.connectionsByUser.get(userId);
    if (connections === undefined) return;
    const frame = JSON.stringify(event);
    for (const connection of [...connections]) this.sendFrame(connection, frame);
  }

  public disconnectUser(userId: string, reason: string): void {
    for (const connection of [...(this.connectionsByUser.get(userId) ?? [])]) this.closeConnection(connection, CLOSE_CODES.forbidden, reason);
  }

  public sweepConnections(): void {
    const now = this.clock.now().getTime();
    for (const connection of [...this.allConnections]) {
      if (connection.state !== "open") {
        if (now - connection.openedAt > this.options.authenticationTimeoutSeconds * 1000) this.closeConnection(connection, CLOSE_CODES.unauthenticated, "Authenticate first");
        continue;
      }
      if (now - connection.lastActivityAt > this.options.heartbeatSeconds * 2000) {
        this.closeConnection(connection, CLOSE_CODES.heartbeatMissed, "Heartbeat missed");
        continue;
      }
      try {
        connection.socket.sendPing();
      } catch {
        this.closeConnection(connection, CLOSE_CODES.goingAway, "Socket failed");
      }
    }
  }

  public countOpenConnections(userId: string): number {
    return this.connectionsByUser.get(userId)?.size ?? 0;
  }

  public closeEverything(): void {
    for (const connection of [...this.allConnections]) this.closeConnection(connection, CLOSE_CODES.goingAway, "Server shutting down");
  }

  private async authenticate(connection: RealtimeConnection, message: ClientMessage): Promise<void> {
    if (message.type !== "auth" || connection.state !== "awaiting_authentication") {
      if (connection.state === "awaiting_authentication") this.closeConnection(connection, CLOSE_CODES.unauthenticated, "Authenticate first");
      return;
    }
    connection.state = "authenticating";
    const principal = await this.resolvePrincipal(message);
    if (connection.state === "closed") return;
    if (principal === undefined) return this.closeConnection(connection, CLOSE_CODES.unauthenticated, "Invalid credentials");
    if (!rolesGrantPermission(principal.roles, "messages:use")) return this.closeConnection(connection, CLOSE_CODES.forbidden, "Not allowed");
    connection.principal = principal;
    connection.state = "open";
    const userConnections = this.connectionsByUser.get(principal.userId) ?? new Set<RealtimeConnection>();
    userConnections.add(connection);
    this.connectionsByUser.set(principal.userId, userConnections);
    while (userConnections.size > this.options.maximumConnectionsPerUser) {
      const oldest = [...userConnections].sort((left, right) => left.openedAt - right.openedAt || left.id - right.id)[0];
      if (oldest === undefined) break;
      this.closeConnection(oldest, CLOSE_CODES.replacedByNewerConnection, "Too many connections");
    }
    this.sendDirect(connection, { type: "auth.ok", userId: principal.userId });
  }

  private async resolvePrincipal(message: ClientMessage): Promise<Principal | undefined> {
    try {
      if (typeof message.ticket === "string" && message.ticket.length > 0) return await this.authenticator.authenticateWithTicket(message.ticket);
      if (typeof message.accessToken === "string" && message.accessToken.length > 0) return await this.authenticator.authenticateWithAccessToken(message.accessToken);
    } catch {
      return undefined;
    }
    return undefined;
  }

  private parseClientMessage(text: string): ClientMessage | undefined {
    try {
      const parsed: unknown = JSON.parse(text);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as ClientMessage) : undefined;
    } catch {
      return undefined;
    }
  }

  private sendDirect(connection: RealtimeConnection, event: RealtimeEvent): void {
    this.sendFrame(connection, JSON.stringify(event));
  }

  private sendFrame(connection: RealtimeConnection, frame: string): void {
    if (connection.state === "closed") return;
    if (connection.socket.countBufferedBytes() + frame.length > this.options.maximumBufferedBytes) {
      this.closeConnection(connection, CLOSE_CODES.slowConsumer, "Slow consumer");
      return;
    }
    try {
      connection.socket.send(frame);
    } catch (error) {
      this.logger.warn("A realtime socket send failed", { error: error instanceof Error ? error.message : String(error) });
      this.closeConnection(connection, CLOSE_CODES.goingAway, "Socket failed");
    }
  }

  private closeConnection(connection: RealtimeConnection, code: number, reason: string): void {
    connection.close(code, reason);
    this.releaseConnection(connection);
  }
}
