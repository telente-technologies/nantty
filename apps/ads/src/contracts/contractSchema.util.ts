export type ContractSchema =
  | { readonly kind: "string"; readonly oneOf?: readonly string[] }
  | { readonly kind: "number" | "boolean" | "null" | "any" }
  | { readonly kind: "nullable"; readonly inner: ContractSchema }
  | { readonly kind: "array"; readonly item: ContractSchema }
  | { readonly kind: "object"; readonly fields: Readonly<Record<string, ContractSchema>>; readonly optional: readonly string[] };

export const c = {
  string: (oneOf?: readonly string[]): ContractSchema => ({ kind: "string", oneOf }),
  number: (): ContractSchema => ({ kind: "number" }),
  boolean: (): ContractSchema => ({ kind: "boolean" }),
  any: (): ContractSchema => ({ kind: "any" }),
  nullable: (inner: ContractSchema): ContractSchema => ({ kind: "nullable", inner }),
  array: (item: ContractSchema): ContractSchema => ({ kind: "array", item }),
  object: (fields: Record<string, ContractSchema>, optional: readonly string[] = []): ContractSchema => ({ kind: "object", fields, optional }),
  page: (item: ContractSchema): ContractSchema => c.object({ data: c.array(item), nextCursor: c.nullable(c.string()) }),
};

export function validateAgainstContract(schema: ContractSchema, value: unknown, path = "$"): string[] {
  switch (schema.kind) {
    case "any":
      return [];
    case "null":
      return value === null ? [] : [`${path}: expected null`];
    case "nullable":
      return value === null ? [] : validateAgainstContract(schema.inner, value, path);
    case "string":
      if (typeof value !== "string") return [`${path}: expected string, got ${typeof value}`];
      return schema.oneOf && !schema.oneOf.includes(value) ? [`${path}: "${value}" is not one of ${schema.oneOf.join("|")}`] : [];
    case "number":
    case "boolean":
      return typeof value === schema.kind ? [] : [`${path}: expected ${schema.kind}, got ${typeof value}`];
    case "array":
      if (!Array.isArray(value)) return [`${path}: expected array, got ${value === null ? "null" : typeof value}`];
      return value.flatMap((entry, index) => validateAgainstContract(schema.item, entry, `${path}[${index}]`));
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path}: expected object`];
      const record = value as Record<string, unknown>;
      return Object.entries(schema.fields).flatMap(([key, fieldSchema]) => {
        if (!(key in record)) return schema.optional.includes(key) ? [] : [`${path}.${key}: missing`];
        if (record[key] === undefined && schema.optional.includes(key)) return [];
        return validateAgainstContract(fieldSchema, record[key], `${path}.${key}`);
      });
    }
  }
}
