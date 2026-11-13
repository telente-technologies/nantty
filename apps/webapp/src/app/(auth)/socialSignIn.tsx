"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCallback, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { WebappRequestError } from "@/services/clientApi.service";
import {
  createSocialSignInNonce,
  hashSocialSignInNonce,
  readNonceFromIdentityToken,
  signInWithSocialProvider,
  type SocialSignInIdentity,
  type SocialSignInProvider,
} from "@/services/socialSignIn.service";
import { TextField } from "@/components/ui/field";
import { isBirthdayValidForNewAccount } from "./signup/signupRules.util";

import formStyles from "./authForm.module.css";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim() ?? "";

interface GoogleCredentialResponse {
  readonly credential?: string;
}

interface GoogleIdentityApi {
  initialize(options: { readonly client_id: string; readonly nonce: string; readonly callback: (response: GoogleCredentialResponse) => void; readonly auto_select: false }): void;
  renderButton(element: HTMLElement, options: { readonly theme: "outline" | "filled_black"; readonly size: "large"; readonly text: "continue_with"; readonly shape: "pill"; readonly width: number }): void;
}

interface AppleSignInResponse {
  readonly authorization?: { readonly id_token?: string; readonly state?: string };
  readonly user?: { readonly name?: { readonly firstName?: string | null; readonly lastName?: string | null } | null };
}

interface AppleSignInApi {
  init(options: { readonly clientId: string; readonly scope: string; readonly redirectURI: string; readonly state: string; readonly nonce: string; readonly usePopup: true }): void;
  signIn(): Promise<AppleSignInResponse>;
}

declare global {
  interface Window {
    google?: { readonly accounts?: { readonly id?: GoogleIdentityApi } };
    AppleID?: { readonly auth?: AppleSignInApi };
  }
}

interface BirthdayChallenge {
  readonly provider: SocialSignInProvider;
  readonly identity?: SocialSignInIdentity;
}

export function SocialSignInButtons({ redirectTo = "/" }: { readonly redirectTo?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [signingInWith, setSigningInWith] = useState<SocialSignInProvider | null>(null);
  const [birthdayChallenge, setBirthdayChallenge] = useState<BirthdayChallenge | null>(null);
  const [birthday, setBirthday] = useState("");
  const [googleSdkReady, setGoogleSdkReady] = useState(false);
  const [appleSdkReady, setAppleSdkReady] = useState(false);
  const [providerSdkError, setProviderSdkError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const socialRequestInFlightRef = useRef(false);

  const completeSocialSignIn = useCallback(async (provider: SocialSignInProvider, identity?: SocialSignInIdentity, birthdayValue?: string) => {
    if (socialRequestInFlightRef.current) return;
    socialRequestInFlightRef.current = true;
    setNotice(null);
    setSigningInWith(provider);
    try {
      const result = await signInWithSocialProvider(provider, identity, birthdayValue);
      if (result.notice) showToast({ text: result.notice });
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      if (error instanceof WebappRequestError && error.code === "BIRTHDAY_REQUIRED") {
        setBirthdayChallenge({ provider, identity });
        setBirthday("");
        setNotice(null);
        return;
      }
      setNotice(error instanceof WebappRequestError ? error.message : "Sign-in failed");
    } finally {
      socialRequestInFlightRef.current = false;
      setSigningInWith(null);
    }
  }, [redirectTo, router]);

  const configureGoogleButton = useCallback(() => {
    const googleIdentity = window.google?.accounts?.id;
    const element = googleButtonRef.current;
    if (!googleClientId || !googleIdentity || !element) return;
    const nonce = createSocialSignInNonce();
    googleIdentity.initialize({
      client_id: googleClientId,
      nonce,
      auto_select: false,
      callback: (response) => {
        const idToken = response.credential;
        if (!idToken) {
          setNotice("Google didn’t return a sign-in token. Please try again.");
          return;
        }
        if (readNonceFromIdentityToken(idToken) !== nonce) {
          setNotice("Google sign-in could not be verified. Please try again.");
          return;
        }
        void completeSocialSignIn("google", { idToken, nonce });
      },
    });
    element.replaceChildren();
    googleIdentity.renderButton(element, {
      theme: document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "filled_black" : "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: Math.max(220, Math.min(element.clientWidth || 360, 420)),
    });
  }, [completeSocialSignIn]);

  const startAppleSignIn = async () => {
    if (!appleClientId) {
      await completeSocialSignIn("apple");
      return;
    }
    const appleAuth = window.AppleID?.auth;
    if (!appleSdkReady || !appleAuth) {
      setProviderSdkError("Apple sign-in is still loading. Please try again in a moment.");
      return;
    }
    try {
      setProviderSdkError(null);
      const nonce = createSocialSignInNonce();
      const state = createSocialSignInNonce();
      const expectedNonce = await hashSocialSignInNonce(nonce);
      appleAuth.init({
        clientId: appleClientId,
        scope: "name email",
        redirectURI: window.location.origin,
        state,
        nonce: expectedNonce,
        usePopup: true,
      });
      const response = await appleAuth.signIn();
      const identityToken = response.authorization?.id_token;
      if (response.authorization?.state !== state || !identityToken) {
        throw new Error("Apple sign-in could not be verified. Please try again.");
      }
      if (readNonceFromIdentityToken(identityToken) !== expectedNonce) {
        throw new Error("Apple sign-in could not be verified. Please try again.");
      }
      const appleName = response.user?.name;
      const fullName = appleName ? { givenName: appleName.firstName ?? null, familyName: appleName.lastName ?? null } : null;
      await completeSocialSignIn("apple", { identityToken, nonce, fullName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Apple sign-in failed. Please try again.";
      if (!/cancel/i.test(message)) setNotice(message);
    }
  };

  const handleBirthdayContinue = () => {
    if (!birthdayChallenge) return;
    void completeSocialSignIn(birthdayChallenge.provider, birthdayChallenge.identity, birthday);
  };

  const birthdayText = birthday ? (() => {
    const [year, month, day] = birthday.split("-");
    return `${day}/${month}/${year}`;
  })() : "";
  const birthdayIsValid = birthdayText.length === 10 && isBirthdayValidForNewAccount(birthdayText);

  return (
    <>
      {googleClientId ? <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => { setGoogleSdkReady(true); configureGoogleButton(); }} onError={() => setProviderSdkError("Google sign-in couldn’t load. Check your connection and try again.")} /> : null}
      {appleClientId ? <Script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js" strategy="afterInteractive" onReady={() => setAppleSdkReady(true)} onError={() => setProviderSdkError("Apple sign-in couldn’t load. Check your connection and try again.")} /> : null}
      {birthdayChallenge ? (
        <div className={formStyles.socialBirthday}>
          <p className={formStyles.helperText}>Add your birthday to finish creating your account. It won’t be shown publicly.</p>
          <TextField label="Birthday" type="date" autoComplete="bday" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
          {birthday && !birthdayIsValid ? <p className={formStyles.formError} role="alert">Enter a valid birthday. You must be at least 13 to use Nantty.</p> : null}
          <Button fullWidth size="lg" busy={signingInWith === birthdayChallenge.provider} disabled={!birthdayIsValid || signingInWith !== null} onClick={handleBirthdayContinue}>
            Continue with {birthdayChallenge.provider === "apple" ? "Apple" : "Google"}
          </Button>
        </div>
      ) : null}
      <Button variant="secondary" fullWidth size="lg" leadingIcon={<AppIcon name="apple24" size={24} />} busy={signingInWith === "apple"} disabled={signingInWith !== null || birthdayChallenge !== null || (Boolean(appleClientId) && !appleSdkReady)} onClick={() => void startAppleSignIn()}>
        Continue with Apple
      </Button>
      {googleClientId ? <div ref={googleButtonRef} className={formStyles.googleIdentityButton} aria-label="Continue with Google" aria-busy={signingInWith === "google"} hidden={birthdayChallenge !== null || signingInWith === "google"} data-ready={googleSdkReady ? "true" : "false"}>
        {!googleSdkReady ? <span role="status">Loading Google sign-in…</span> : null}
      </div> : (
        <Button variant="secondary" fullWidth size="lg" leadingIcon={<AppIcon name="google24" size={24} />} busy={signingInWith === "google"} disabled={signingInWith !== null || birthdayChallenge !== null} onClick={() => void completeSocialSignIn("google")}>
          Continue with Google
        </Button>
      )}
      {providerSdkError ? <p className={formStyles.formError} role="alert">{providerSdkError}</p> : null}
      {notice ? (
        <p className={formStyles.formError} role="alert">
          {notice}
        </p>
      ) : null}
    </>
  );
}
