"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { authService } from "@/services/auth.service";
import { WebappRequestError, readErrorMessageForDisplay, sendRequestToWebappServer } from "@/services/clientApi.service";
import type { User } from "@/types";

import { SocialSignInButtons } from "../socialSignIn";
import styles from "../authForm.module.css";

type SignUpStep = "contact" | "verify" | "birthday" | "password" | "username" | "topics";

const STEP_ORDER: readonly SignUpStep[] = ["contact", "verify", "birthday", "password", "username", "topics"];

const USERNAME_UNAVAILABLE_MESSAGES: Record<string, string> = {
  taken: "That username is already taken.",
  reserved: "That username is reserved for Zudomart and can't be used.",
  invalid: "Use 3–20 letters, numbers, underscores or full stops.",
  recently_used: "That username was used recently and isn't available yet.",
  withheld: "That username has been withheld under our policies.",
};

const DEFAULT_USERNAME_HINT = "3–20 characters. Letters, numbers, underscores and full stops only.";
const MINIMUM_TOPICS_TO_CONTINUE = 3;
const MINIMUM_CUSTOMISING_SCREEN_DURATION_MS = 1500;
const RESEND_SECONDS = 60;

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function removeNonDigitCharacters(value: string): string {
  return value.replace(/\D/g, "");
}

function insertSlashesIntoBirthdayInput(value: string): string {
  const digits = removeNonDigitCharacters(value).slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

function parseBirthdayFromDayMonthYear(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealCalendarDate ? date : null;
}

function calculateAgeInYears(birthday: Date, today = new Date()): number {
  let age = today.getUTCFullYear() - birthday.getUTCFullYear();
  const birthdayNotYetReachedThisYear =
    today.getUTCMonth() < birthday.getUTCMonth() || (today.getUTCMonth() === birthday.getUTCMonth() && today.getUTCDate() < birthday.getUTCDate());
  if (birthdayNotYetReachedThisYear) age -= 1;
  return age;
}

const MINIMUM_ACCOUNT_AGE_IN_YEARS = 13;

function isBirthdayValidForNewAccount(value: string): boolean {
  const birthday = parseBirthdayFromDayMonthYear(value);
  if (!birthday) return false;
  const age = calculateAgeInYears(birthday);
  return age >= MINIMUM_ACCOUNT_AGE_IN_YEARS && age <= 120;
}

function checkPasswordRequirements(password: string) {
  return {
    hasLengthBetweenEightAndTwenty: password.length >= 8 && password.length <= 20,
    hasLetterAndNumber: /[A-Za-z]/.test(password) && /\d/.test(password),
    hasSpecialCharacter: /[^A-Za-z0-9\s]/.test(password),
  };
}

function calculatePasswordStrength(password: string): "none" | "weak" | "medium" | "strong" {
  if (!password) return "none";
  const met = Object.values(checkPasswordRequirements(password)).filter(Boolean).length;
  if (met === 3) return "strong";
  if (met === 2) return "medium";
  return "weak";
}

function isPasswordStrongEnoughForAccount(password: string): boolean {
  return Object.values(checkPasswordRequirements(password)).filter(Boolean).length === 3;
}

function isValidUsername(value: string): boolean {
  return /^[A-Za-z0-9_.]{3,20}$/.test(value);
}

function PasswordRequirements({ password }: { readonly password: string }) {
  const requirements = checkPasswordRequirements(password);
  const strength = calculatePasswordStrength(password);
  const strengthWidth: Record<string, string> = { none: "0%", weak: "17%", medium: "52%", strong: "100%" };
  const strengthColour: Record<string, string> = {
    none: "var(--surface-sunken)",
    weak: "var(--error)",
    medium: "var(--caution)",
    strong: "var(--success)",
  };
  const strengthLabel: Record<string, string> = { none: "", weak: "Weak", medium: "Medium", strong: "Strong" };

  return (
    <div className={styles.passwordRules}>
      <p className={styles.passwordRulesHeading}>Your password must have at least:</p>
      <div className={styles.ruleList}>
        <PasswordRule met={requirements.hasLengthBetweenEightAndTwenty} label="8 characters (20 max)" />
        <PasswordRule met={requirements.hasLetterAndNumber} label="1 letter and 1 number" />
        <PasswordRule met={requirements.hasSpecialCharacter} label="1 special character (Example: # $ % ! @)" />
      </div>
      <div className={styles.strengthTrack} role="progressbar" aria-label={`Password strength ${strengthLabel[strength] || "not set"}`}>
        <div className={styles.strengthFill} style={{ width: strengthWidth[strength], background: strengthColour[strength] }} />
      </div>
      <p className={styles.strengthRow}>
        Password strength:
        {strength !== "none" ? <span className={styles.strengthLabel}>{strengthLabel[strength]}</span> : null}
      </p>
    </div>
  );
}

function PasswordRule({ met, label }: { readonly met: boolean; readonly label: string }) {
  return (
    <p className={met ? `${styles.rule} ${styles.ruleMet}` : styles.rule} aria-label={`${label}${met ? ", met" : ", not met"}`}>
      <AppIcon name="check16" size={16} />
      {label}
    </p>
  );
}

function describeCodeDestination(destination: string): string {
  if (!destination.startsWith("+234")) return destination;
  const digits = destination.slice(4);
  return `+234 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export default function SignUpPage() {
  const router = useRouter();
  const otpInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<SignUpStep>("contact");
  const [destination, setDestination] = useState("");
  const [email, setEmail] = useState("");
  const [saveLoginInfo, setSaveLoginInfo] = useState(true);
  const [code, setCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [birthdayText, setBirthdayText] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [resendRestartKey, setResendRestartKey] = useState(0);
  const [registered, setRegistered] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customisingFeed, setCustomisingFeed] = useState(false);
  const [debouncedUsername, setDebouncedUsername] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUsername(username.trim()), 350);
    return () => clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    setResendSeconds(RESEND_SECONDS);
    const interval = setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(interval);
  }, [resendRestartKey]);

  const usernameQuery = useQuery({
    queryKey: ["username-availability", debouncedUsername.toLowerCase()],
    queryFn: () => authService.checkUsernameAvailability(debouncedUsername),
    enabled: isValidUsername(debouncedUsername) && step === "username" && !registered,
    staleTime: 30_000,
    retry: false,
  });

  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: () => authService.fetchPersonalizationTopics(),
    enabled: step === "topics",
    retry: false,
  });

  const usernameSettled = debouncedUsername === username.trim() && !usernameQuery.isFetching;
  const usernameAvailable = usernameQuery.data?.available ?? null;

  const availabilityMessage = !username.trim()
    ? null
    : !isValidUsername(username.trim())
      ? USERNAME_UNAVAILABLE_MESSAGES.invalid
      : !usernameSettled
        ? "Checking…"
        : usernameAvailable
          ? `@${debouncedUsername} is available`
          : usernameQuery.data?.reason
            ? (USERNAME_UNAVAILABLE_MESSAGES[usernameQuery.data.reason] ?? "That username isn't available. Try another one.")
            : null;

  const isUsernameUsable = usernameSettled && isValidUsername(username.trim()) && usernameAvailable === true;

  const canContinue = useMemo(() => {
    if (step === "contact") return isValidEmailAddress(email);
    if (step === "verify") return code.length === 6;
    if (step === "birthday") return isBirthdayValidForNewAccount(birthdayText);
    if (step === "password") return isPasswordStrongEnoughForAccount(password);
    if (step === "username") return isUsernameUsable;
    return selectedTopics.length >= MINIMUM_TOPICS_TO_CONTINUE;
  }, [step, email, code, birthdayText, password, usernameSettled, username, usernameAvailable, selectedTopics]);

  function goBack() {
    setError(null);
    setMessage(null);
    const index = STEP_ORDER.indexOf(step);
    const previousStep = index > 0 ? STEP_ORDER[index - 1] : undefined;
    if (!previousStep) {
      router.push("/welcome");
      return;
    }
    setStep(previousStep);
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!canContinue) return;
    const nextDestination = email.trim().toLowerCase();
    setBusy(true);
    try {
      await authService.sendOneTimeCode(nextDestination, "signup");
      setDestination(nextDestination);
      setCode("");
      setMessage(null);
      setResendRestartKey((key) => key + 1);
      setStep("verify");
    } catch (caught) {
      setError(caught instanceof WebappRequestError ? caught.message : "We couldn't send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(enteredCode: string) {
    if (enteredCode.length !== 6 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const verified = await authService.verifyOneTimeCode(destination, enteredCode, "signup");
      setOtpToken(verified.otpToken);
      setStep("birthday");
    } catch (caught) {
      setError(caught instanceof WebappRequestError ? caught.message : "That code didn't work. Try again.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      await authService.sendOneTimeCode(destination, "signup");
      setResendRestartKey((key) => key + 1);
      setMessage("We sent you a new code.");
    } catch {
      setError("We couldn't resend the code. Please try again.");
    }
  }

  async function handleRequestCall() {
    setError(null);
    try {
      await authService.sendOneTimeCode(destination, "signup");
      setResendRestartKey((key) => key + 1);
      setMessage("You'll get a call with your code shortly.");
    } catch {
      setError("We couldn't resend the code. Please try again.");
    }
  }

  async function createAccount(chosenUsername: string | undefined) {
    if (!otpToken) {
      setError("Your verification expired. Go back and request a new code.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await sendRequestToWebappServer<{ user: User }>("/auth/register", {
        method: "POST",
        body: {
          email: destination,
          ...(chosenUsername ? { username: chosenUsername } : {}),
          password,
          birthday: parseBirthdayFromDayMonthYear(birthdayText)?.toISOString().slice(0, 10) ?? "",
          otpToken,
        },
      });
      setRegistered(true);
      setStep("topics");
    } catch (caught) {
      setError(caught instanceof WebappRequestError ? caught.message : "We couldn't create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (step === "contact") {
      await handleContactSubmit(event);
      return;
    }
    if (step === "verify") {
      await verifyCode(code);
      return;
    }
    if (step === "username") {
      if (!isUsernameUsable) return;
      await createAccount(username.trim());
      return;
    }
    const nextStep = STEP_ORDER[STEP_ORDER.indexOf(step) + 1];
    if (nextStep) setStep(nextStep);
  }

  async function finishSignUp() {
    setError(null);
    setBusy(true);
    try {
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(readErrorMessageForDisplay(caught));
      setBusy(false);
    }
  }

  async function handleTopicsSubmit() {
    if (customisingFeed || selectedTopics.length < MINIMUM_TOPICS_TO_CONTINUE) return;
    setCustomisingFeed(true);
    await Promise.all([
      authService.saveSelectedTopics(selectedTopics).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, MINIMUM_CUSTOMISING_SCREEN_DURATION_MS)),
    ]);
    router.push("/");
    router.refresh();
  }

  const heading =
    step === "contact"
      ? {
          title: "What’s your email?",
          subtitle: "We’ll send you a 6-digit code to confirm it’s you.",
        }
      : step === "verify"
        ? { title: "Enter 6-digit code", subtitle: `Your code was sent to ${describeCodeDestination(destination)}` }
        : step === "birthday"
          ? { title: "When’s your birthday?", subtitle: "Your birthday won’t be shown publicly." }
          : step === "password"
            ? { title: "Create password", subtitle: "Choose a strong password to protect your account." }
            : step === "username"
              ? {
                  title: "Create username",
                  subtitle:
                    "We've suggested one for you. Keep it, change it, or skip — you'll keep the suggested username and can change it later in Settings.",
                }
              : { title: "Personalize your feed", subtitle: customisingFeed ? "Customizing your feed..." : "Add or edit topics you follow. Chose three or more." };

  if (step === "topics") {
    return (
      <div>
        <div className={styles.topBar}>
          <button type="button" className={styles.backButton} aria-label="Go back" onClick={goBack}>
            <AppIcon name="arrowLeft24" size={24} />
          </button>
          <button type="button" className={styles.skipButton} disabled={busy || customisingFeed} onClick={() => finishSignUp()}>
            Skip
          </button>
        </div>

        <div className={styles.stepHeading}>
          <h1 className={styles.stepTitle}>{heading.title}</h1>
          <p className={styles.stepSubtitle}>{heading.subtitle}</p>
        </div>

        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}

        {customisingFeed ? (
          <p className={styles.customisingNote}>
            <Spinner label="Customizing your feed" />
          </p>
        ) : topicsQuery.isLoading ? (
          <Spinner label="Loading topics" />
        ) : (
          <div className={styles.topicGrid} role="group" aria-label="Choose your interests">
            {(topicsQuery.data ?? []).map((topic) => {
              const active = selectedTopics.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  className={active ? `${styles.topicChip} ${styles.topicChipActive}` : styles.topicChip}
                  aria-pressed={active}
                  onClick={() => setSelectedTopics((previous) => (active ? previous.filter((id) => id !== topic.id) : [...previous, topic.id]))}
                >
                  {topic.name}
                </button>
              );
            })}
          </div>
        )}

        {customisingFeed ? null : (
          <div className={styles.stack} style={{ marginTop: "var(--space-6)" }}>
            <Button type="button" fullWidth size="lg" onClick={handleTopicsSubmit} disabled={selectedTopics.length < MINIMUM_TOPICS_TO_CONTINUE}>
              Continue
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.topBar}>
        <button type="button" className={styles.backButton} aria-label="Go back" onClick={goBack}>
          <AppIcon name="arrowLeft24" size={24} />
        </button>
        {step === "username" ? (
          <button type="button" className={styles.skipButton} disabled={busy} onClick={() => void createAccount(undefined)}>
            Skip
          </button>
        ) : null}
      </div>

      <div className={styles.stepHeading}>
        <h1 className={styles.stepTitle}>{heading.title}</h1>
        <p className={styles.stepSubtitle}>{heading.subtitle}</p>
      </div>

      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className={styles.successText} role="status">
          {message}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleCreateAccount} noValidate>
        {step === "contact" ? (
          <>
            <TextField
              label="Email"
              name="destination"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              hideLabel
            />

            <label className={styles.checkRow}>
              <input type="checkbox" checked={saveLoginInfo} onChange={(event) => setSaveLoginInfo(event.target.checked)} />
              <span className={styles.checkLabel}>Save login info on your device to log in automatically next time.</span>
            </label>

            <Button type="submit" fullWidth size="lg" busy={busy} disabled={!canContinue}>
              Send Code
            </Button>
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <div className={styles.otpRow} onClick={() => otpInputRef.current?.focus()}>
              <input
                ref={otpInputRef}
                className={styles.otpHiddenInput}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                aria-label="Verification code"
                value={code}
                autoFocus
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(next);
                  if (next.length === 6) void verifyCode(next);
                }}
              />
              {Array.from({ length: 6 }, (_, index) => {
                const isActive = index === Math.min(code.length, 5);
                const classes = [styles.otpBox, isActive ? styles.otpBoxActive : "", error ? styles.otpBoxInvalid : ""].filter(Boolean).join(" ");
                return (
                  <span key={index} className={classes}>
                    {code[index] ?? ""}
                  </span>
                );
              })}
            </div>

            <div className={styles.resendRow}>
              {resendSeconds > 0 ? (
                <button type="button" className={styles.resendButton} disabled>
                  Resend code {resendSeconds}s
                </button>
              ) : (
                <button type="button" className={styles.resendButtonLink} onClick={() => void handleResend()}>
                  Resend code
                </button>
              )}
            </div>
            <div className={styles.resendRow}>
              <span>Didn’t get a code?</span>
              <button type="button" className={styles.resendButtonLink} onClick={() => void handleRequestCall()}>
                Request a call
              </button>
            </div>

            <Button type="submit" fullWidth size="lg" busy={busy} disabled={!canContinue}>
              Next
            </Button>
          </>
        ) : null}

        {step === "birthday" ? (
          <>
            <TextField
              label="Birthday"
              name="birthday"
              inputMode="numeric"
              autoComplete="bday"
              placeholder="dd/mm/yyyy"
              maxLength={10}
              autoFocus
              value={birthdayText}
              onChange={(event) => setBirthdayText(insertSlashesIntoBirthdayInput(event.target.value))}
              error={
                birthdayText.length === 10 && !isBirthdayValidForNewAccount(birthdayText)
                  ? parseBirthdayFromDayMonthYear(birthdayText)
                    ? `You must be at least ${MINIMUM_ACCOUNT_AGE_IN_YEARS} years old to use Zudomart.`
                    : "Enter a real date, like 27/10/2000."
                  : null
              }
            />
            <Button type="submit" fullWidth size="lg" disabled={!canContinue}>
              Next
            </Button>
          </>
        ) : null}

        {step === "password" ? (
          <>
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter password"
              maxLength={20}
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordRequirements password={password} />
            <Button type="submit" fullWidth size="lg" disabled={!canContinue}>
              Next
            </Button>
          </>
        ) : null}

        {step === "username" ? (
          <>
            <TextField
              label="Username"
              name="username"
              autoComplete="username"
              placeholder="Username"
              maxLength={20}
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))}
            />
            <p className={!error && availabilityMessage === `@${debouncedUsername} is available` ? styles.successText : error || availabilityMessage ? styles.errorText : styles.mutedText}>
              {error ?? availabilityMessage ?? DEFAULT_USERNAME_HINT}
            </p>
            <Button type="submit" fullWidth size="lg" busy={busy} disabled={!canContinue}>
              Confirm
            </Button>
          </>
        ) : null}
      </form>

      {step === "contact" ? (
        <>
          <p className={styles.switchPrompt}>
            Already have an account?{" "}
            <Link href="/login" className={styles.linkStrong}>
              Log in
            </Link>
          </p>
          <div className={styles.divider} role="presentation">
            <span className={styles.dividerText}>or</span>
          </div>
          <div className={styles.socialStack}>
            <SocialSignInButtons />
          </div>
        </>
      ) : null}
    </div>
  );
}
