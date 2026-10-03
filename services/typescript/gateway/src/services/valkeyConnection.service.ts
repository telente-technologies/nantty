import { connect as connectPlain, type Socket } from "node:net";
import { connect as connectTls } from "node:tls";

type RespValue = string | number | null | RespValue[] | Error;
interface PendingCommand {
  readonly resolve: (value: RespValue) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

function parseRespValue(buffer: Buffer, offset: number): { value: RespValue; next: number } | undefined {
  const lineEnd = buffer.indexOf("\r\n", offset);
  if (lineEnd === -1) return undefined;
  const kind = String.fromCharCode(buffer[offset] ?? 0);
  const line = buffer.toString("utf8", offset + 1, lineEnd);
  const afterLine = lineEnd + 2;
  if (kind === "+") return { value: line, next: afterLine };
  if (kind === "-") return { value: new Error(line), next: afterLine };
  if (kind === ":") return { value: Number(line), next: afterLine };
  if (kind === "$") {
    const length = Number(line);
    if (length < 0) return { value: null, next: afterLine };
    if (buffer.length < afterLine + length + 2) return undefined;
    return { value: buffer.toString("utf8", afterLine, afterLine + length), next: afterLine + length + 2 };
  }
  if (kind === "*") {
    const count = Number(line);
    if (count < 0) return { value: null, next: afterLine };
    const items: RespValue[] = [];
    let cursor = afterLine;
    for (let index = 0; index < count; index += 1) {
      const item = parseRespValue(buffer, cursor);
      if (item === undefined) return undefined;
      items.push(item.value);
      cursor = item.next;
    }
    return { value: items, next: cursor };
  }
  throw new Error(`Unexpected RESP type ${kind}`);
}

function encodeCommand(args: readonly (string | number)[]): string {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(String(arg))}\r\n${String(arg)}\r\n`).join("")}`;
}

export class ValkeyConnection {
  private socket: Socket | undefined;
  private connecting: Promise<Socket> | undefined;
  private buffer: Buffer = Buffer.alloc(0);
  private readonly pending: PendingCommand[] = [];

  public constructor(private readonly url: URL, private readonly commandTimeoutMs = 250) {}

  public async command(args: readonly (string | number)[]): Promise<RespValue> {
    const socket = await this.ensureConnected();
    return this.send(socket, args);
  }

  public close(): void {
    this.socket?.destroy();
  }

  private send(socket: Socket, args: readonly (string | number)[]): Promise<RespValue> {
    return new Promise<RespValue>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("valkey command timed out"));
        socket.destroy();
      }, this.commandTimeoutMs);
      this.pending.push({ resolve, reject, timer });
      socket.write(encodeCommand(args));
    });
  }

  private ensureConnected(): Promise<Socket> {
    if (this.socket !== undefined && !this.socket.destroyed) return Promise.resolve(this.socket);
    this.connecting ??= this.openSocket().finally(() => { this.connecting = undefined; });
    return this.connecting;
  }

  private async openSocket(): Promise<Socket> {
    const secure = this.url.protocol === "rediss:";
    const port = Number(this.url.port === "" ? 6379 : this.url.port);
    const socket = await new Promise<Socket>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("valkey connect timed out")), 1000);
      const opened = secure ? connectTls({ host: this.url.hostname, port, servername: this.url.hostname }) : connectPlain({ host: this.url.hostname, port });
      opened.once(secure ? "secureConnect" : "connect", () => { clearTimeout(timer); resolve(opened); });
      opened.once("error", (error) => { clearTimeout(timer); reject(error); });
    });
    socket.setNoDelay(true);
    socket.unref();
    this.buffer = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => this.handleData(chunk));
    socket.on("error", () => socket.destroy());
    socket.on("close", () => this.failPending(new Error("valkey connection closed")));
    this.socket = socket;
    const password = decodeURIComponent(this.url.password);
    if (password !== "") {
      const username = decodeURIComponent(this.url.username);
      const reply = await this.send(socket, username === "" ? ["AUTH", password] : ["AUTH", username, password]);
      if (reply instanceof Error) throw reply;
    }
    return socket;
  }

  private handleData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let parsed = parseRespValue(this.buffer, 0);
    while (parsed !== undefined) {
      this.buffer = this.buffer.subarray(parsed.next);
      const command = this.pending.shift();
      if (command !== undefined) {
        clearTimeout(command.timer);
        if (parsed.value instanceof Error) command.reject(parsed.value);
        else command.resolve(parsed.value);
      }
      parsed = parseRespValue(this.buffer, 0);
    }
  }

  private failPending(error: Error): void {
    for (const command of this.pending.splice(0)) {
      clearTimeout(command.timer);
      command.reject(error);
    }
  }
}
