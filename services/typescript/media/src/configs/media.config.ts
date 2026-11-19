import { readGatewayIdentitySecretsFromEnvironment } from "../middlewares/gatewayIdentity.middleware.js";

export interface MediaConfig {
  readonly gatewayIdentitySecrets?: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly internalToken: string;
  readonly messageBus: "rabbitmq" | "none";
  readonly rabbitMqUrl: string;
  readonly jobsEnabled: boolean;
  readonly workerConcurrency: number;
  readonly outboxPollIntervalMs: number;
  readonly sweepIntervalMs: number;
  readonly chunkSizeBytes: number;
  readonly storage: {
    readonly region: string;
    readonly endpoint: string | undefined;
    readonly publicEndpoint: string | undefined;
    readonly accessKeyId: string | undefined;
    readonly secretAccessKey: string | undefined;
    readonly forcePathStyle: boolean;
    readonly createBuckets: boolean;
    readonly quarantineBucket: string;
    readonly publicBucket: string;
    readonly privateBucket: string;
    readonly privateKmsKeyId: string | undefined;
  };
  readonly cdn: {
    readonly baseUrl: string | undefined;
    readonly privateBaseUrl: string | undefined;
    readonly keyPairId: string | undefined;
    readonly privateKeyPem: string | undefined;
    readonly signedUrlLifetimeSeconds: number;
  };
  readonly clamAv: { readonly host: string; readonly port: number } | undefined;
  readonly heifConvertPath: string;
  readonly allowProxiedChunks: boolean;
  readonly allowUnscannedUploads: boolean;
  readonly ffmpeg: { readonly mode: "auto" | "required" | "disabled"; readonly ffmpegPath: string; readonly ffprobePath: string; readonly fpcalcPath: string; readonly timeoutMs: number; readonly maximumHeight: number };
  readonly moderation: { readonly baseUrl: string | undefined; readonly token: string; readonly failMode: "allow" | "hold"; readonly holdThreshold: number; readonly rejectThreshold: number; readonly timeoutMs: number };
  readonly childSafety?: { readonly baseUrl: string | undefined; readonly internalToken: string; readonly requireScan: boolean; readonly timeoutMs: number };
}

function readOrDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? fallback : value;
}

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

export function loadMediaConfigFromEnvironment(): MediaConfig {
  const problems: string[] = [];
  const databaseUrl = readOptional("DATABASE_URL") ?? "";
  if (databaseUrl === "") problems.push("DATABASE_URL is required");
  const clamAvHost = readOptional("CLAMAV_HOST");
  const ffmpegMode = readOrDefault("FFMPEG_MODE", "auto");
  const heifConvertPath = readOrDefault("HEIF_CONVERT_PATH", "heif-convert");
  const moderationFailMode = readOrDefault("MODERATION_FAIL_MODE", "hold");
  const config: MediaConfig = {
    gatewayIdentitySecrets: readGatewayIdentitySecretsFromEnvironment(problems),
    host: readOrDefault("HOST", "0.0.0.0"),
    port: Number(readOrDefault("PORT", "8108")),
    databaseUrl,
    internalToken: readOrDefault("MEDIA_INTERNAL_TOKEN", ""),
    messageBus: readOrDefault("EVENT_BUS", "rabbitmq") === "none" ? "none" : "rabbitmq",
    rabbitMqUrl: readOrDefault("RABBITMQ_URL", ""),
    jobsEnabled: readOrDefault("JOBS_ENABLED", "true") === "true",
    workerConcurrency: Number(readOrDefault("WORKER_CONCURRENCY", "2")),
    outboxPollIntervalMs: Number(readOrDefault("OUTBOX_POLL_INTERVAL_MS", "500")),
    sweepIntervalMs: Number(readOrDefault("SWEEP_INTERVAL_MS", String(15 * 60 * 1000))),
    chunkSizeBytes: Number(readOrDefault("UPLOAD_CHUNK_SIZE_BYTES", String(8 * 1024 * 1024))),
    storage: {
      region: readOrDefault("S3_REGION", "eu-west-1"),
      endpoint: readOptional("S3_ENDPOINT"),
      publicEndpoint: readOptional("S3_PUBLIC_ENDPOINT"),
      accessKeyId: readOptional("S3_ACCESS_KEY_ID"),
      secretAccessKey: readOptional("S3_SECRET_ACCESS_KEY"),
      forcePathStyle: readOrDefault("S3_FORCE_PATH_STYLE", "false") === "true",
      createBuckets: readOrDefault("S3_CREATE_BUCKETS", "false") === "true",
      quarantineBucket: readOrDefault("MEDIA_QUARANTINE_BUCKET", "nantty-media-quarantine"),
      publicBucket: readOrDefault("MEDIA_PUBLIC_BUCKET", "nantty-media-public"),
      privateBucket: readOrDefault("MEDIA_PRIVATE_BUCKET", "nantty-media-private"),
      privateKmsKeyId: readOptional("MEDIA_PRIVATE_KMS_KEY_ID"),
    },
    cdn: {
      baseUrl: readOptional("CDN_BASE_URL"),
      privateBaseUrl: readOptional("CDN_PRIVATE_BASE_URL"),
      keyPairId: readOptional("CDN_SIGNING_KEY_PAIR_ID"),
      privateKeyPem: readOptional("CDN_SIGNING_PRIVATE_KEY")?.replaceAll("\\n", "\n"),
      signedUrlLifetimeSeconds: Number(readOrDefault("CDN_SIGNED_URL_LIFETIME_SECONDS", "3600")),
    },
    clamAv: clamAvHost === undefined ? undefined : { host: clamAvHost, port: Number(readOrDefault("CLAMAV_PORT", "3310")) },
    heifConvertPath,
    allowProxiedChunks: readOrDefault("ALLOW_PROXIED_CHUNKS", "false") === "true",
    allowUnscannedUploads: readOrDefault("MEDIA_ALLOW_UNSCANNED", "false") === "true",
    ffmpeg: {
      mode: ffmpegMode === "required" || ffmpegMode === "disabled" ? ffmpegMode : "auto",
      ffmpegPath: readOrDefault("FFMPEG_PATH", "ffmpeg"),
      ffprobePath: readOrDefault("FFPROBE_PATH", "ffprobe"),
      fpcalcPath: readOrDefault("FPCALC_PATH", "fpcalc"),
      timeoutMs: Number(readOrDefault("FFMPEG_TIMEOUT_MS", String(10 * 60 * 1000))),
      maximumHeight: Number(readOrDefault("VIDEO_MAXIMUM_HEIGHT", "720")),
    },
    moderation: {
      baseUrl: readOptional("MODERATION_URL"),
      token: readOrDefault("MODERATION_TOKEN", ""),
      failMode: moderationFailMode === "hold" ? "hold" : "allow",
      holdThreshold: Number(readOrDefault("MODERATION_HOLD_THRESHOLD", "0.5")),
      rejectThreshold: Number(readOrDefault("MODERATION_REJECT_THRESHOLD", "0.97")),
      timeoutMs: Number(readOrDefault("MODERATION_TIMEOUT_MS", "5000")),
    },
    childSafety: {
      baseUrl: readOptional("MODERATION_CHILD_SAFETY_URL"),
      internalToken: readOrDefault("MODERATION_INTERNAL_API_TOKEN", ""),
      requireScan: readOrDefault("MEDIA_REQUIRE_CHILD_SAFETY_SCAN", process.env["NODE_ENV"] === "production" ? "true" : "false") === "true",
      timeoutMs: Number(readOrDefault("MODERATION_TIMEOUT_MS", "5000")),
    },
  };
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push("PORT must be a positive integer");
  if (process.env["NODE_ENV"] === "production" && (config.internalToken.length < 32 || /local[-_]only|change[-_]?me/i.test(config.internalToken))) {
    problems.push("MEDIA_INTERNAL_TOKEN must be a non-placeholder secret of at least 32 characters in production");
  }
  if (moderationFailMode !== "allow" && moderationFailMode !== "hold") problems.push("MODERATION_FAIL_MODE must be allow or hold");
  if ((config.cdn.keyPairId === undefined) !== (config.cdn.privateKeyPem === undefined)) problems.push("CDN_SIGNING_KEY_PAIR_ID and CDN_SIGNING_PRIVATE_KEY must be set together");
  if (config.chunkSizeBytes < 5 * 1024 * 1024) problems.push("UPLOAD_CHUNK_SIZE_BYTES must be at least 5 MiB");
  if (problems.length > 0) throw new Error(`Invalid media configuration: ${problems.join("; ")}`);
  return config;
}
