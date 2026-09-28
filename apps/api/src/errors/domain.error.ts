import { ConflictError, ForbiddenError, NotFoundError, UnprocessableEntityError } from "@zudojs/errors";

export function notFound(what: string): NotFoundError {
  return new NotFoundError(`${what} was not found.`);
}

export function forbidden(message = "You are not allowed to do this."): ForbiddenError {
  return new ForbiddenError(message);
}

export function invalidState(message: string): ConflictError {
  return new ConflictError(message);
}

export function unprocessable(message: string): UnprocessableEntityError {
  return new UnprocessableEntityError(message);
}

export function insufficientFunds(): UnprocessableEntityError {
  return new UnprocessableEntityError("Insufficient funds.");
}
