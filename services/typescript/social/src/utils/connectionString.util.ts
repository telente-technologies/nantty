export function splitSchemaFromConnectionString(databaseUrl: string): { readonly connectionString: string; readonly schema: string | undefined } {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get("schema") ?? undefined;
  url.searchParams.delete("schema");
  return { connectionString: url.toString(), schema };
}
