export const accountIdHeaderName = "x-zudomart-account-id";
export const ageBracketHeaderName = "x-zudomart-age-bracket";
export const clientRegionHeaderName = "x-client-region";
export const internalTokenHeaderName = "x-internal-token";
export const defaultPageSize = 20;
export const maximumPageSize = 50;
export const maximumQueryLength = 100;
export const maximumScopeLength = 64;
export const maximumRecentSearchesPerScope = 20;
export const suggestionLimit = 8;
export const legacyGroupLimit = 10;
export const processedEventRetentionDays = 7;
export const trigramSimilarityThreshold = 0.25;

export const kindRankingBonus: Readonly<Record<string, number>> = {
  user: 0.2,
  store: 0.15,
  brand: 0.15,
  product: 0.1,
  hashtag: 0.05,
  post: 0,
  clip: 0,
  sound: -0.05,
  category: 0.1,
};
