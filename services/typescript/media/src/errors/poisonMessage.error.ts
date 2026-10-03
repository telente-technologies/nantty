export class PoisonMessageError extends Error {
  public constructor(reason: string) {
    super(`poison message: ${reason}`);
  }
}
