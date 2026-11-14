import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";

import { ApiError, requestJson, type ApiRequestOptions } from "../api/apiClient";
import { isTerminalSessionFailure } from "./sessionFailure.util";

const REFRESH_TOKEN_KEY = "nantty.messenger.refreshToken.v1";
const TRUSTED_DEVICE_TOKEN_KEY = "nantty.messenger.trustedDeviceToken.v1";
const TRUSTED_DEVICE_ID_KEY = "nantty.messenger.trustedDeviceId.v1";
const INSTALLATION_ID_KEY = "nantty.messenger.installationId.v1";
const MESSENGER_AUTH_BASE = "/api/v1/auth/messenger/authorizations";

export interface MessengerUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user?: MessengerUser;
}

export type AuthStatus = "restoring" | "restoreFailed" | "signedOut" | "authorizationRequired" | "authorizationDenied" | "authorizationExpired" | "signedIn";

export interface MessengerAuthorization {
  readonly authorizationId: string;
  readonly proof: string;
  readonly expiresAt: string;
  readonly methods: readonly string[];
  readonly device: {
    readonly name: string;
    readonly platform: string;
    readonly requestedAt: string;
    readonly approximateLocation: string | null;
  };
}

interface MessengerCreateResponse extends Partial<SessionTokens> {
  readonly authorizationId?: string;
  readonly proof?: string;
  readonly status?: string;
  readonly expiresAt?: string;
  readonly methods?: readonly string[];
  readonly device?: MessengerAuthorization["device"];
  readonly trustedDevice?: { readonly id: string; readonly token: string; readonly expiresAt: string };
}

interface MessengerCompleteResponse extends SessionTokens {
  readonly trustedDevice: { readonly id: string; readonly token: string; readonly expiresAt: string };
}

interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: MessengerUser | null;
  readonly restoreError: string | null;
  readonly authorization: MessengerAuthorization | null;
  readonly signIn: (identifier: string, password: string) => Promise<void>;
  readonly pollAuthorization: () => Promise<string>;
  readonly verifyAuthorizationCode: (code: string) => Promise<void>;
  readonly requestRecoveryCode: () => Promise<string>;
  readonly verifyRecoveryCode: (code: string) => Promise<void>;
  readonly cancelAuthorization: () => void;
  readonly signOut: () => Promise<void>;
  readonly retryRestore: () => Promise<void>;
  readonly request: <T>(path: string, options?: Omit<ApiRequestOptions, "accessToken">) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<MessengerUser | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [authorization, setAuthorization] = useState<MessengerAuthorization | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const userRef = useRef<MessengerUser | null>(null);
  const refreshInFlight = useRef<Promise<string> | null>(null);

  const saveSession = useCallback(async (session: SessionTokens, fallbackUser?: MessengerUser | null) => {
    if (!session.accessToken || !session.refreshToken) {
      throw new ApiError("Nantty returned an incomplete sign-in session.", null, "INVALID_SESSION");
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
    accessTokenRef.current = session.accessToken;
    refreshTokenRef.current = session.refreshToken;
    const nextUser = session.user ?? fallbackUser ?? null;
    userRef.current = nextUser;
    setUser(nextUser);
    setRestoreError(null);
    setAuthorization(null);
    setStatus("signedIn");
  }, []);

  const clearLocalSession = useCallback(async (sessionAccessToken: string | null = accessTokenRef.current) => {
    const accessToken = sessionAccessToken;
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    userRef.current = null;
    setUser(null);
    setRestoreError(null);
    setAuthorization(null);
    setStatus("signedOut");
    await Promise.all([
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(TRUSTED_DEVICE_TOKEN_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(TRUSTED_DEVICE_ID_KEY).catch(() => undefined),
    ]);
    const savedPushToken = await SecureStore.getItemAsync("nantty.messenger.pushToken.v1").catch(() => null);
    if (savedPushToken && accessToken) {
      await requestJson<void>("/api/v1/notifications/device-tokens", {
        method: "DELETE",
        accessToken,
        body: { token: savedPushToken },
      }).catch(() => undefined);
    }
    await import("../api/messengerChat.service").then(({ clearMessengerChatCrypto }) => clearMessengerChatCrypto()).catch(() => undefined);
    await import("../api/messengerImageAttachment.service").then(({ clearDecryptedMessengerImages }) => clearDecryptedMessengerImages()).catch(() => undefined);
    await import("../api/messengerRealtime.service").then(({ clearMessengerRealtime }) => clearMessengerRealtime()).catch(() => undefined);
    await import("../api/chatBubblePreferences.service").then(({ clearChatBubblePreferences }) => clearChatBubblePreferences()).catch(() => undefined);
    await import("../api/messengerNotifications.service").then(({ disableMessengerPush }) => disableMessengerPush()).catch(() => undefined);
    await import("../api/chatBubblesNative.service").then(({ clearAccountBubbleState }) => clearAccountBubbleState()).catch(() => undefined);
    await import("expo-notifications").then(async (Notifications) => {
      await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    }).catch(() => undefined);
  }, []);

  const signOut = useCallback(async () => {
    const accessToken = accessTokenRef.current;
    const refreshToken = refreshTokenRef.current;
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    userRef.current = null;
    setUser(null);
    setRestoreError(null);
    setAuthorization(null);
    setStatus("signedOut");
    const trustedDeviceId = await SecureStore.getItemAsync(TRUSTED_DEVICE_ID_KEY).catch(() => null);
    await clearLocalSession(accessToken);
    try {
      if (trustedDeviceId && accessToken) {
        await requestJson<void>(`/api/v1/auth/messenger/devices/${encodeURIComponent(trustedDeviceId)}`, { method: "DELETE", accessToken });
      } else if (refreshToken) {
        await requestJson<void>("/api/v1/auth/logout", {
          method: "POST",
          accessToken,
          body: { refreshToken },
        });
      }
    } catch {
      // A network failure must not keep the local account open on this device.
    }
  }, [clearLocalSession]);

  const refreshSession = useCallback((): Promise<string> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const refreshToken = refreshTokenRef.current;
    if (!refreshToken) return Promise.reject(new ApiError("Your session has expired. Sign in again.", 401, "SESSION_EXPIRED"));

    const task = (async () => {
      const currentUser = userRef.current;
      const tokens = await requestJson<SessionTokens>("/api/v1/auth/refresh", {
        method: "POST",
        body: { refreshToken },
      });
      await saveSession(tokens, currentUser);
      return tokens.accessToken;
    })();
    refreshInFlight.current = task;
    void task.finally(() => {
      if (refreshInFlight.current === task) refreshInFlight.current = null;
    }).catch(() => undefined);
    return task;
  }, [saveSession]);

  const retryRestore = useCallback(async () => {
    setStatus("restoring");
    setRestoreError(null);
    try {
      const savedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!savedRefreshToken) {
        setStatus("signedOut");
        return;
      }
      refreshTokenRef.current = savedRefreshToken;
      const accessToken = await refreshSession();
      const account = await requestJson<MessengerUser>("/api/v1/users/me", { accessToken });
      userRef.current = account;
      setUser(account);
      setStatus("signedIn");
    } catch (error) {
      if (isTerminalSessionFailure(error)) {
        await clearLocalSession();
        return;
      }
      setRestoreError(errorMessage(error));
      setStatus("restoreFailed");
    }
  }, [clearLocalSession, refreshSession]);

  useEffect(() => {
    void retryRestore();
  }, [retryRestore]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) throw new ApiError("Enter your Nantty email, phone, or username and password.", null, "MISSING_CREDENTIALS");
    const installationId = await getInstallationId();
    const trustedDeviceToken = await SecureStore.getItemAsync(TRUSTED_DEVICE_TOKEN_KEY);
    const deviceName = Platform.OS === "ios" ? "iPhone or iPad" : "Android device";
    const response = await requestJson<MessengerCreateResponse>(MESSENGER_AUTH_BASE, {
      method: "POST",
      headers: { "X-Client-App": "messenger", "X-Client-Platform": Platform.OS },
      body: {
        identifier: cleanIdentifier,
        password,
        platform: Platform.OS,
        deviceName,
        installationId,
        trustedDeviceToken: trustedDeviceToken ?? "",
      },
    });
    if (response.authorizationId && response.proof && response.expiresAt) {
      setAuthorization({
        authorizationId: response.authorizationId,
        proof: response.proof,
        expiresAt: response.expiresAt,
        methods: response.methods ?? [],
        device: response.device ?? { name: deviceName, platform: Platform.OS, requestedAt: new Date().toISOString(), approximateLocation: null },
      });
      setStatus("authorizationRequired");
      return;
    }
    if (response.accessToken && response.refreshToken) {
      const { trustedDevice, ...session } = response;
      if (trustedDevice?.token) {
        await SecureStore.setItemAsync(TRUSTED_DEVICE_TOKEN_KEY, trustedDevice.token);
        await SecureStore.setItemAsync(TRUSTED_DEVICE_ID_KEY, trustedDevice.id);
      }
      await saveSession(session as SessionTokens);
      return;
    }
    throw new ApiError("We couldn’t start your secure sign-in. Please try again.", null, "INVALID_AUTH_RESPONSE");
  }, [saveSession]);

  const completeAuthorization = useCallback(async (challenge: MessengerAuthorization) => {
    const response = await requestJson<MessengerCompleteResponse>(`${MESSENGER_AUTH_BASE}/${encodeURIComponent(challenge.authorizationId)}/complete`, {
      method: "POST",
      accessToken: challenge.proof,
    });
    if (!response.accessToken || !response.refreshToken || !response.trustedDevice?.token) {
      throw new ApiError("We couldn’t finish your secure sign-in. Please try again.", null, "INVALID_AUTH_RESPONSE");
    }
    await SecureStore.setItemAsync(TRUSTED_DEVICE_TOKEN_KEY, response.trustedDevice.token);
    await SecureStore.setItemAsync(TRUSTED_DEVICE_ID_KEY, response.trustedDevice.id);
    const { trustedDevice, ...session } = response;
    await saveSession(session, session.user);
  }, [saveSession]);

  const pollAuthorization = useCallback(async () => {
    const challenge = authorization;
    if (!challenge) throw new ApiError("This sign-in request is no longer available.", null, "AUTHORIZATION_MISSING");
    const result = await requestJson<{ status: string; expiresAt: string; device?: MessengerAuthorization["device"] }>(
      `${MESSENGER_AUTH_BASE}/${encodeURIComponent(challenge.authorizationId)}`,
      { accessToken: challenge.proof },
    );
    if (result.status === "approved") {
      await completeAuthorization(challenge);
      return "completed";
    }
    if (result.status === "denied") {
      setStatus("authorizationDenied");
    } else if (result.status === "expired") {
      setStatus("authorizationExpired");
    } else if (result.status === "completed") {
      setAuthorization(null);
      setStatus("signedOut");
    }
    return result.status;
  }, [authorization, completeAuthorization]);

  const verifyAuthorizationCode = useCallback(async (code: string) => {
    const challenge = authorization;
    if (!challenge) throw new ApiError("This sign-in request is no longer available.", null, "AUTHORIZATION_MISSING");
    await requestJson(`${MESSENGER_AUTH_BASE}/${encodeURIComponent(challenge.authorizationId)}/verify-code`, {
      method: "POST",
      accessToken: challenge.proof,
      body: { code: code.trim() },
    });
    await completeAuthorization(challenge);
  }, [authorization, completeAuthorization]);

  const requestRecoveryCode = useCallback(async () => {
    const challenge = authorization;
    if (!challenge) throw new ApiError("This sign-in request is no longer available.", null, "AUTHORIZATION_MISSING");
    const result = await requestJson<{ status: string; destinationHint: string; expiresIn: number }>(
      `${MESSENGER_AUTH_BASE}/${encodeURIComponent(challenge.authorizationId)}/recovery/email`,
      { method: "POST", accessToken: challenge.proof, body: {} },
    );
    return result.destinationHint;
  }, [authorization]);

  const verifyRecoveryCode = useCallback(async (code: string) => {
    const challenge = authorization;
    if (!challenge) throw new ApiError("This sign-in request is no longer available.", null, "AUTHORIZATION_MISSING");
    await requestJson(`${MESSENGER_AUTH_BASE}/${encodeURIComponent(challenge.authorizationId)}/recovery/verify`, {
      method: "POST",
      accessToken: challenge.proof,
      body: { code: code.trim() },
    });
    await completeAuthorization(challenge);
  }, [authorization, completeAuthorization]);

  const cancelAuthorization = useCallback(() => {
    setAuthorization(null);
    setStatus("signedOut");
  }, []);

  const request = useCallback(async <T,>(path: string, options: Omit<ApiRequestOptions, "accessToken"> = {}): Promise<T> => {
    const accessToken = accessTokenRef.current;
    if (!accessToken) throw new ApiError("Sign in to view your Nantty conversations.", 401, "AUTH_REQUIRED");
    try {
      return await requestJson<T>(path, { ...options, accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      try {
        const renewedAccessToken = await refreshSession();
        return await requestJson<T>(path, { ...options, accessToken: renewedAccessToken });
      } catch (refreshOrRetryError) {
        if (isTerminalSessionFailure(refreshOrRetryError)) await clearLocalSession();
        throw refreshOrRetryError;
      }
    }
  }, [clearLocalSession, refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({ status, user, restoreError, authorization, signIn, pollAuthorization, verifyAuthorizationCode, requestRecoveryCode, verifyRecoveryCode, cancelAuthorization, signOut, retryRestore, request }), [status, user, restoreError, authorization, signIn, pollAuthorization, verifyAuthorizationCode, requestRecoveryCode, verifyRecoveryCode, cancelAuthorization, signOut, retryRestore, request]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function getInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existing) return existing;
  // This stable identifier is not a credential; the server hashes it and still requires approval.
  const generated = `messenger-${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, generated);
  return generated;
}

export function useMessengerAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useMessengerAuth must be used inside AuthProvider.");
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not restore your Nantty session. Check your connection and try again.";
}
