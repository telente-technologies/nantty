import { MissingEventFieldError } from "../errors/notifications.error.js";

export interface MoneyValue {
  readonly amountMinor: number;
  readonly currency: string;
}

export class EventDataReader {
  public constructor(private readonly values: Readonly<Record<string, unknown>>, private readonly path = "data") {}

  public text(key: string, fallback?: string): string {
    const value = this.values[key];
    if (typeof value === "string" && value !== "") return value;
    if (fallback !== undefined) return fallback;
    throw new MissingEventFieldError(`${this.path}.${key}`);
  }

  public optionalText(key: string): string | undefined {
    const value = this.values[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  }

  public integer(key: string, fallback?: number): number {
    const value = this.values[key];
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (fallback !== undefined) return fallback;
    throw new MissingEventFieldError(`${this.path}.${key}`);
  }

  public bool(key: string, fallback = false): boolean {
    const value = this.values[key];
    return typeof value === "boolean" ? value : fallback;
  }

  public money(key: string): MoneyValue {
    const found = this.optionalMoney(key);
    if (found === undefined) throw new MissingEventFieldError(`${this.path}.${key}`);
    return found;
  }

  public optionalMoney(key: string): MoneyValue | undefined {
    const value = this.values[key];
    if (typeof value !== "object" || value === null) return undefined;
    const { amountMinor, currency } = value as Record<string, unknown>;
    return typeof amountMinor === "number" && Number.isInteger(amountMinor) && typeof currency === "string" && currency !== "" ? { amountMinor, currency } : undefined;
  }

  public textList(key: string): string[] {
    const value = this.values[key];
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  }

  public object(key: string): EventDataReader {
    const value = this.values[key];
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new MissingEventFieldError(`${this.path}.${key}`);
    return new EventDataReader(value as Record<string, unknown>, `${this.path}.${key}`);
  }

  public optionalObject(key: string): EventDataReader | undefined {
    const value = this.values[key];
    return typeof value === "object" && value !== null && !Array.isArray(value) ? new EventDataReader(value as Record<string, unknown>, `${this.path}.${key}`) : undefined;
  }

  public objectList(key: string): EventDataReader[] {
    const value = this.values[key];
    if (!Array.isArray(value)) throw new MissingEventFieldError(`${this.path}.${key}`);
    return value.map((entry, index) => new EventDataReader(entry as Record<string, unknown>, `${this.path}.${key}[${index}]`));
  }

  public get rawValues(): Readonly<Record<string, unknown>> {
    return this.values;
  }
}
