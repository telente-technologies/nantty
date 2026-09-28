export interface CategoryRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly parentId: string | null;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
}

export type CategoryFields = Omit<CategoryRecord, "id">;
