// Each app's local env file and the keys mode:backend / mode:mock own. Every other key in the file is left alone.
export const appTargets = [
  { name: "webapp", kind: "next", directory: "apps/webapp", envFile: ".env.local", port: 3500, mockKey: "WEBAPP_USE_MOCKS", prefixKey: "WEBAPP_REAL_API_PREFIXES", apiKey: "WEBAPP_API_URL", mediaKeys: ["WEBAPP_MEDIA_URL", "WEBAPP_UPLOAD_ORIGINS"] },
  { name: "seller", kind: "next", directory: "apps/seller", envFile: ".env.local", port: 3200, mockKey: "SELLER_USE_MOCKS", prefixKey: "SELLER_REAL_API_PREFIXES", apiKey: "SELLER_API_URL", mediaKeys: ["SELLER_MEDIA_URL", "SELLER_UPLOAD_ORIGINS"] },
  { name: "studio", kind: "next", directory: "apps/studio", envFile: ".env.local", port: 3600, mockKey: "STUDIO_USE_MOCKS", prefixKey: "STUDIO_REAL_API_PREFIXES", apiKey: "STUDIO_API_URL", mediaKeys: ["STUDIO_MEDIA_URL"] },
  { name: "ads", kind: "next", directory: "apps/ads", envFile: ".env.local", port: 3300, mockKey: "ADS_USE_MOCKS", prefixKey: "ADS_REAL_API_PREFIXES", apiKey: "ADS_API_URL", mediaKeys: ["ADS_MEDIA_URL", "ADS_UPLOAD_URL"] },
  { name: "admin", kind: "next", directory: "apps/admin", envFile: ".env.local", port: 3400, mockKey: "ADMIN_USE_MOCKS", prefixKey: "ADMIN_REAL_API_PREFIXES", apiKey: "ADMIN_API_URL", mediaKeys: ["ADMIN_MEDIA_URL"] },
  { name: "web", kind: "next", directory: "apps/web", envFile: ".env.local", port: 3100, mockKey: null, prefixKey: null, apiKey: "NEXT_PUBLIC_API_URL", mediaKeys: [] },
  { name: "mobile", kind: "expo", directory: "apps/mobile", envFile: ".env", port: null, mockKey: "EXPO_PUBLIC_USE_MOCKS", prefixKey: "EXPO_PUBLIC_REAL_API_PREFIXES", apiKey: "EXPO_PUBLIC_API_URL", mediaKeys: [] },
];

export const defaultGatewayUrl = "http://localhost:8080";
export const defaultMediaOrigin = "http://localhost:18333";

export function findTarget(name) {
  const target = appTargets.find((candidate) => candidate.name === name);
  if (target === undefined) throw new Error(`unknown app "${name}"; pick one of ${appTargets.map((candidate) => candidate.name).join(", ")}`);
  return target;
}

export function backendValuesFor(target, { apiUrl, mediaOrigin }) {
  const values = { [target.apiKey]: apiUrl };
  if (target.mockKey !== null) values[target.mockKey] = "false";
  if (target.prefixKey !== null) values[target.prefixKey] = "";
  for (const key of target.mediaKeys) values[key] = mediaOrigin;
  return values;
}

export function mockValuesFor(target) {
  const values = {};
  if (target.mockKey !== null) values[target.mockKey] = "true";
  if (target.prefixKey !== null) values[target.prefixKey] = "";
  return values;
}
