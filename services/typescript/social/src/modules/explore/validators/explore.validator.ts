import { schema } from "@zudojs/schema";

import { trendCategories } from "../../../constants/ranking.constant.js";

const country = schema.string().regex(/^[A-Z]{2}$/).optional();
const categoryWithoutTabs = schema.enum(["news", "sports", "entertainment", "music", "tech", "business", "fashion", "gaming", "comedy", "religion", "food", "politics", "lifestyle"]).optional();

export const trendsQuerySchema = schema.object({ country, category: categoryWithoutTabs, limit: schema.coerce.number().int().min(1).max(30).optional() });
export const headlinesQuerySchema = schema.object({ country, category: categoryWithoutTabs, limit: schema.coerce.number().int().min(1).max(12).optional() });
export const whoToFollowQuerySchema = schema.object({ country, limit: schema.coerce.number().int().min(1).max(30).optional() });
export const postsForYouQuerySchema = schema.object({ country, category: schema.enum([...trendCategories]).optional(), cursor: schema.string().max(200).optional(), limit: schema.coerce.number().int().min(1).max(30).optional() });
