"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

import {
  ArrowRightIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  SignInIcon,
  UserPlusIcon,
} from "@/components/ui/icons";
import { readDeveloperDocsHref, readNanttyWebUrl, readSandboxPortalUrl } from "@/config/site.config";

import { StepUpVerificationPanel } from "./stepUpVerification";
import styles from "./developerLoginWorkspace.module.css";

interface SessionPayload {
  readonly configured: boolean;
  readonly authenticated: boolean;
}

const destinations = [
  { value: "/dashboard", label: "Developer Overview Dashboard" },
  { value: "/credentials", label: "API Credentials (ntsb_test_ / ntlive_)" },
  { value: "/organization", label: "Organization & Team Roles" },
  { value: "/onboarding", label: "Guided Developer Onboarding" },
] as const;

type DestinationPath = (typeof destinations)[number]["value"];
type AuthMode = "signin" | "signup";

const otpDigitSlots = [0, 1, 2, 3, 4, 5] as const;

function resolveAllowedDestination(candidate: string | null): DestinationPath {
  const matched = destinations.find((item) => item.value === candidate);
  return matched ? matched.value : "/dashboard";
}

export function DeveloperLoginWorkspace() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [nextPath, setNextPath] = useState<DestinationPath>("/dashboard");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  // Direct email/username + password sign-in state
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Account creation (Email 6-digit OTP + Profile + Password) state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupDigits, setSignupDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpToken, setOtpToken] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameHint, setUsernameHint] = useState("");
  const [signupBirthday, setSignupBirthday] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupNotice, setSignupNotice] = useState("");
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionPayload | null) => {
        if (!active) return;
        const params = new URLSearchParams(window.location.search);
        setNextPath(resolveAllowedDestination(params.get("next")));
        if (params.get("mode") === "signup") {
          setAuthMode("signup");
        }
        if (data) setSession(data);
      })
      .catch(() => {
        if (active) setSession({ configured: false, authenticated: false });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const webLoginUrl = `${readNanttyWebUrl()}/login`;
  const webSignupUrl = `${readNanttyWebUrl()}/signup`;
  const webForgotUrl = `${readNanttyWebUrl()}/forgot-password`;
  const combinedSignupCode = signupDigits.join("");

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !loginPassword) {
      setLoginError("Enter your email or username and password.");
      return;
    }
    setLoginBusy(true);
    setLoginError("");
    try {
      const response = await fetch("/api/auth/password-login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ identifier: trimmedIdentifier, password: loginPassword }),
      });
      const payload = (await response.json().catch(() => null)) as { authenticated?: boolean; message?: string } | null;
      if (!response.ok || !payload?.authenticated) {
        throw new Error(payload?.message ?? "Invalid email/username or password.");
      }
      setSession((prev) => ({ configured: prev?.configured ?? true, authenticated: true }));
      router.push(nextPath);
      router.refresh();
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : "Could not sign in right now.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function sendSignupOtp() {
    const trimmedEmail = signupEmail.trim().toLowerCase();
    if (!trimmedEmail.includes("@")) {
      setSignupError("Enter a valid email address first.");
      return;
    }
    setSignupBusy(true);
    setSignupError("");
    setSignupNotice("");
    try {
      const response = await fetch("/api/developer/otp/send", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ destination: trimmedEmail, purpose: "signup" }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not send a verification code.");
      }
      setOtpSent(true);
      setOtpToken("");
      setResendCooldown(60);
      setSignupDigits(["", "", "", "", "", ""]);
      setSignupNotice(`A 6-digit verification code was sent to ${trimmedEmail}.`);
      window.setTimeout(() => digitRefs.current[0]?.focus(), 20);
    } catch (cause) {
      setSignupError(cause instanceof Error ? cause.message : "Could not send verification code.");
    } finally {
      setSignupBusy(false);
    }
  }

  async function verifySignupOtp() {
    const trimmedEmail = signupEmail.trim().toLowerCase();
    if (!/^\d{6}$/.test(combinedSignupCode)) {
      setSignupError("Enter all 6 digits from your verification email.");
      return;
    }
    setSignupBusy(true);
    setSignupError("");
    try {
      const response = await fetch("/api/developer/otp/verify", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ destination: trimmedEmail, purpose: "signup", code: combinedSignupCode }),
      });
      const payload = (await response.json().catch(() => null)) as { otpToken?: string; message?: string } | null;
      if (!response.ok || !payload?.otpToken) {
        throw new Error(payload?.message ?? "Verification code was rejected or expired.");
      }
      setOtpToken(payload.otpToken);
      setSignupNotice("Email verified. Complete your profile and password below.");
    } catch (cause) {
      setSignupError(cause instanceof Error ? cause.message : "Could not verify email code.");
    } finally {
      setSignupBusy(false);
    }
  }

  async function checkUsername(candidate: string) {
    const clean = candidate.trim().toLowerCase();
    if (clean.length < 3) {
      setUsernameStatus("idle");
      setUsernameHint("");
      return;
    }
    setUsernameStatus("checking");
    try {
      const query = new URLSearchParams({ username: clean });
      if (signupName.trim()) query.set("name", signupName.trim());
      const response = await fetch(`/api/auth/username-available?${query.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        available?: boolean;
        reason?: string;
        suggestion?: string;
      } | null;
      if (!response.ok || !payload) {
        setUsernameStatus("idle");
        return;
      }
      if (payload.available) {
        setUsernameStatus("available");
        setUsernameHint(`@${clean} is available`);
      } else {
        setUsernameStatus("taken");
        setUsernameHint(payload.suggestion ? `Unavailable · Try @${payload.suggestion}` : payload.reason ?? "Username is already taken");
      }
    } catch {
      setUsernameStatus("idle");
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpToken) {
      setSignupError("Verify your 6-digit email code first.");
      return;
    }
    if (!signupBirthday) {
      setSignupError("Enter your date of birth (YYYY-MM-DD).");
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError("Choose a password with at least 8 characters.");
      return;
    }
    setSignupBusy(true);
    setSignupError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          email: signupEmail.trim().toLowerCase(),
          otpToken,
          name: signupName.trim() || undefined,
          username: signupUsername.trim().toLowerCase() || undefined,
          birthday: signupBirthday,
          password: signupPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { authenticated?: boolean; message?: string } | null;
      if (!response.ok || !payload?.authenticated) {
        throw new Error(payload?.message ?? "Could not create your Nantty account.");
      }
      setSession((prev) => ({ configured: prev?.configured ?? true, authenticated: true }));
      const targetDestination: DestinationPath = nextPath === "/dashboard" ? "/onboarding" : nextPath;
      router.push(targetDestination);
      router.refresh();
    } catch (cause) {
      setSignupError(cause instanceof Error ? cause.message : "Could not complete account creation.");
    } finally {
      setSignupBusy(false);
    }
  }

  function handleSignupDigitChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setSignupDigits((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }
    if (cleaned.length > 1) {
      const spread = cleaned.slice(0, 6).split("");
      setSignupDigits((prev) => prev.map((_, i) => spread[i] ?? ""));
      const nextFocus = Math.min(5, spread.length - 1);
      digitRefs.current[nextFocus]?.focus();
      return;
    }
    setSignupDigits((prev) => prev.map((d, i) => (i === index ? cleaned : d)));
    if (index < 5) digitRefs.current[index + 1]?.focus();
  }

  function handleSignupDigitKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !signupDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  function handleSignupDigitPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    event.preventDefault();
    const chars = text.split("");
    setSignupDigits(otpDigitSlots.map((slot) => chars[slot] ?? ""));
    digitRefs.current[Math.min(5, chars.length - 1)]?.focus();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Nantty Identity &amp; Access</p>
          <h1>Sign in, create account &amp; OTP verification</h1>
          <p>Create a Nantty developer account with 6-digit email verification, sign in with SSO or password, and verify step-up tokens for sensitive organization actions.</p>
        </div>
        <div className={styles.headerBadges}>
          <span className={`${styles.pill} ${session?.authenticated ? styles.pillSuccess : styles.pillNeutral}`}>
            {session === null ? "Checking session…" : session.authenticated ? "Session active" : "Signed out"}
          </span>
          <span className={styles.pill}>OAuth 2.0 PKCE S256</span>
        </div>
      </header>

      <div className={styles.grid}>
        <section className={styles.primaryCard} aria-labelledby="auth-card-title">
          {session?.authenticated ? (
            <div className={styles.activeSessionBlock}>
              <div className={styles.sessionHero}>
                <CheckCircleIcon size={24} className={styles.successIcon} />
                <div>
                  <h2 id="auth-card-title">You are signed in to Nantty Developers</h2>
                  <p>Your HttpOnly session cookie is active across Developer organizations, credentials, and Sandbox controls.</p>
                </div>
              </div>
              <div className={styles.quickLinks}>
                <Link href={nextPath} className={styles.primaryAction}>
                  <span>Continue to workspace</span>
                  <ArrowRightIcon size={16} />
                </Link>
                <a href={readSandboxPortalUrl()} className={styles.secondaryAction}>
                  Open Sandbox ↗
                </a>
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className={styles.ghostAction}>Sign out</button>
                </form>
              </div>
            </div>
          ) : (
            <div className={styles.ssoBlock}>
              <div className={styles.modeTabs} role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "signin"}
                  className={authMode === "signin" ? styles.modeTabActive : styles.modeTab}
                  onClick={() => setAuthMode("signin")}
                >
                  <SignInIcon size={16} />
                  <span>Sign in</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "signup"}
                  className={authMode === "signup" ? styles.modeTabActive : styles.modeTab}
                  onClick={() => setAuthMode("signup")}
                >
                  <UserPlusIcon size={16} />
                  <span>Create account</span>
                </button>
              </div>

              {authMode === "signin" ? (
                <>
                  <div className={styles.ssoTitleRow}>
                    <SignInIcon size={22} className={styles.brandIcon} />
                    <div>
                      <h2 id="auth-card-title">Sign in with your Nantty account</h2>
                      <p>One Nantty account unlocks Developer organizations, API credentials, webhooks, and the isolated Sandbox.</p>
                    </div>
                  </div>

                  <form action="/api/auth/login" method="get" className={styles.ssoForm}>
                    <label className={styles.selectField}>
                      Destination after sign-in
                      <select
                        name="next"
                        value={nextPath}
                        onChange={(e) => setNextPath(resolveAllowedDestination(e.target.value))}
                      >
                        {destinations.map((dest) => (
                          <option key={dest.value} value={dest.value}>{dest.label}</option>
                        ))}
                      </select>
                    </label>

                    <button type="submit" className={styles.primaryAction}>
                      <LockKeyIcon size={17} />
                      <span>Continue with Nantty SSO</span>
                      <ArrowRightIcon size={16} />
                    </button>
                  </form>

                  <div className={styles.divider}>
                    <span>Or sign in directly with password</span>
                  </div>

                  <form onSubmit={handlePasswordLogin} className={styles.authForm}>
                    <label className={styles.inputField}>
                      Email or username
                      <input
                        type="text"
                        autoComplete="username"
                        placeholder="dev@company.com or @handle"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                      />
                    </label>
                    <label className={styles.inputField}>
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </label>
                    {loginError ? <p className={styles.errorBanner} role="alert">{loginError}</p> : null}
                    <div className={styles.formActionsRow}>
                      <button type="submit" className={styles.secondaryAction} disabled={loginBusy}>
                        <span>{loginBusy ? "Signing in…" : "Sign in with password"}</span>
                        <ArrowRightIcon size={15} />
                      </button>
                      <a href={webForgotUrl} target="_blank" rel="noreferrer" className={styles.inlineLink}>
                        Forgot password? ↗
                      </a>
                    </div>
                  </form>

                  {session && !session.configured ? (
                    <div className={styles.noticeBox} role="note">
                      <strong>Identity SSO endpoint standby</strong>
                      <span>Cross-domain SSO redirects require <code>DEVELOPER_SSO_*</code> environment configuration. You can sign in on <a href={webLoginUrl} target="_blank" rel="noreferrer">Nantty.com</a>, create an account in the tab above, or browse all documentation &amp; API reference endpoints.</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className={styles.ssoTitleRow}>
                    <UserPlusIcon size={22} className={styles.brandIcon} />
                    <div>
                      <h2 id="auth-card-title">Create your Nantty developer account</h2>
                      <p>Verify your email with a 6-digit code, pick your handle, and start building in Sandbox right away. You can also register on <a href={webSignupUrl} target="_blank" rel="noreferrer" className={styles.inlineLink}>Nantty.com ↗</a>.</p>
                    </div>
                  </div>

                  <div className={styles.signupCard}>
                    <div className={styles.emailVerifyRow}>
                      <label className={styles.inputField}>
                        Work or personal email
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="developer@company.com"
                          value={signupEmail}
                          disabled={Boolean(otpToken)}
                          onChange={(e) => setSignupEmail(e.target.value)}
                        />
                      </label>
                      {!otpToken ? (
                        <button
                          type="button"
                          className={styles.secondaryAction}
                          disabled={signupBusy || resendCooldown > 0}
                          onClick={sendSignupOtp}
                        >
                          <EnvelopeSimpleIcon size={16} />
                          <span>
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : otpSent ? "Resend code" : "Send 6-digit code"}
                          </span>
                        </button>
                      ) : (
                        <span className={styles.verifiedTag}>
                          <CheckCircleIcon size={15} />
                          <span>Email verified</span>
                        </span>
                      )}
                    </div>

                    {otpSent && !otpToken ? (
                      <div className={styles.otpVerifyBlock}>
                        <div className={styles.otpDigitsHeader}>
                          <span>Enter the 6-digit code sent to {signupEmail.trim().toLowerCase()}</span>
                        </div>
                        <div className={styles.otpDigitsRow}>
                          {otpDigitSlots.map((slot) => (
                            <input
                              key={`signup-otp-${slot}`}
                              ref={(el) => {
                                digitRefs.current[slot] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              aria-label={`Verification digit ${slot + 1}`}
                              className={styles.otpDigitBox}
                              value={signupDigits[slot]}
                              onChange={(e) => handleSignupDigitChange(slot, e.target.value)}
                              onKeyDown={(e) => handleSignupDigitKeyDown(slot, e)}
                              onPaste={handleSignupDigitPaste}
                            />
                          ))}
                          <button
                            type="button"
                            className={styles.primaryAction}
                            disabled={signupBusy || combinedSignupCode.length !== 6}
                            onClick={verifySignupOtp}
                          >
                            {signupBusy ? "Verifying…" : "Verify code"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {otpToken ? (
                      <form onSubmit={handleCreateAccount} className={styles.authForm}>
                        <div className={styles.twoColFields}>
                          <label className={styles.inputField}>
                            Full name
                            <input
                              type="text"
                              autoComplete="name"
                              placeholder="Ada Okafor"
                              value={signupName}
                              onChange={(e) => setSignupName(e.target.value)}
                            />
                          </label>
                          <label className={styles.inputField}>
                            Username (optional)
                            <input
                              type="text"
                              autoComplete="username"
                              placeholder="ada.okafor"
                              value={signupUsername}
                              onChange={(e) => {
                                setSignupUsername(e.target.value);
                                setUsernameStatus("idle");
                              }}
                              onBlur={(e) => {
                                void checkUsername(e.target.value);
                              }}
                            />
                            {usernameStatus !== "idle" ? (
                              <span
                                className={
                                  usernameStatus === "available"
                                    ? styles.hintSuccess
                                    : usernameStatus === "taken"
                                      ? styles.hintWarn
                                      : styles.hintMuted
                                }
                              >
                                {usernameStatus === "checking" ? "Checking handle…" : usernameHint}
                              </span>
                            ) : null}
                          </label>
                        </div>

                        <div className={styles.twoColFields}>
                          <label className={styles.inputField}>
                            Date of birth
                            <input
                              type="date"
                              required
                              autoComplete="bday"
                              value={signupBirthday}
                              onChange={(e) => setSignupBirthday(e.target.value)}
                            />
                          </label>
                          <label className={styles.inputField}>
                            Password (8+ characters)
                            <input
                              type="password"
                              required
                              minLength={8}
                              autoComplete="new-password"
                              placeholder="At least 8 characters"
                              value={signupPassword}
                              onChange={(e) => setSignupPassword(e.target.value)}
                            />
                          </label>
                        </div>

                        <button type="submit" className={styles.primaryAction} disabled={signupBusy}>
                          <UserPlusIcon size={17} />
                          <span>{signupBusy ? "Creating account…" : "Create Nantty developer account"}</span>
                          <ArrowRightIcon size={16} />
                        </button>
                      </form>
                    ) : null}

                    {signupNotice ? <p className={styles.noticeSuccess} role="status">{signupNotice}</p> : null}
                    {signupError ? <p className={styles.errorBanner} role="alert">{signupError}</p> : null}
                  </div>
                </>
              )}
            </div>
          )}

          <div className={styles.divider}>
            <span>Step-up identity &amp; 6-digit OTP verification</span>
          </div>

          <StepUpVerificationPanel
            title="Step-up verification (OTP or Password)"
            description={
              session?.authenticated
                ? "Verify a 6-digit one-time code sent to your email or confirm your password to issue a single-use step-up token for ownership transfer and high-privilege operations."
                : "Sign in above first to bind a step-up verification token to your active session. You can also request a login OTP code to your Nantty account email."
            }
            submitLabel="Verify & issue step-up token"
          />
        </section>

        <aside className={styles.guideColumn} aria-label="Authentication architecture">
          <div className={styles.nightCard}>
            <div className={styles.nightHead}>
              <ShieldCheckIcon size={18} />
              <span>Security architecture</span>
            </div>
            <h3>How accounts, SSO &amp; OTP work</h3>
            <ol className={styles.flowSteps}>
              <li>
                <strong>1. Unified Nantty Account Creation</strong>
                <p>New developers verify their email with a 6-digit OTP via <code>/api/v1/auth/otp/send</code> &amp; <code>verify</code>, register via <code>/api/v1/auth/register</code>, and immediately create a Developer Organization.</p>
              </li>
              <li>
                <strong>2. PKCE S256 SSO &amp; HttpOnly Session</strong>
                <p>SSO and password sign-in exchange credentials server-side and set an <code>HttpOnly</code> cookie never exposed to client JavaScript.</p>
              </li>
              <li>
                <strong>3. 6-Digit Email OTP &amp; Step-Up</strong>
                <p>Sensitive operations such as organization ownership transfer require fresh 6-digit OTP or password verification via <code>/api/v1/auth/step-up</code>.</p>
              </li>
            </ol>
            <div className={styles.nightLinks}>
              <Link href={readDeveloperDocsHref("authentication")}>Read Auth &amp; SSO docs →</Link>
              <Link href="/onboarding">Start Developer Onboarding →</Link>
              <Link href="/dashboard">Return to Dashboard →</Link>
            </div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoHead}>
              <KeyIcon size={18} />
              <strong>API tokens vs. portal login</strong>
            </div>
            <p>Portal login grants your browser RBAC access to create and manage organizations. API integrations authenticate separately with <code>ntsb_test_</code> (Sandbox) or <code>ntlive_</code> (Production) bearer keys.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
