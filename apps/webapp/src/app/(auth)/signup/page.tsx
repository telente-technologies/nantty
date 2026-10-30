"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { authService } from "@/services/auth.service";
import { WebappRequestError, readErrorMessageForDisplay, rememberCsrfTokenForRequests, sendRequestToWebappServer } from "@/services/clientApi.service";
import type { User } from "@/types";

import { SocialSignInButtons } from "../socialSignIn";
import styles from "../authForm.module.css";
import { BirthdayStepFields, ContactStepFields, PasswordStepFields, UsernameStepFields } from "./signupFieldSteps";
import { describeSignUpStepHeading, isBirthdayValidForNewAccount, isPasswordStrongEnoughForAccount, isValidEmailAddress, MINIMUM_CUSTOMISING_SCREEN_DURATION_MS, MINIMUM_TOPICS_TO_CONTINUE, parseBirthdayFromDayMonthYear, RESEND_SECONDS, STEP_ORDER, type SignUpStep } from "./signupRules.util";
import { SignUpTopicsStep } from "./signupTopicsStep";
import { SignUpVerifyCodeStep } from "./signupVerifyCodeStep";
import { useResendCountdown } from "./useResendCountdown.hook";
import { useUsernameAvailability } from "./useUsernameAvailability.hook";
import { runWithAsyncActionLock } from "@/utils/asyncActionLock.util";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<SignUpStep>("contact");
  const [destination, setDestination] = useState("");
  const [email, setEmail] = useState("");
  const [saveLoginInfo, setSaveLoginInfo] = useState(true);
  const [code, setCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [birthdayText, setBirthdayText] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [conflictSuggestions, setConflictSuggestions] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submissionInFlight = useRef(false);
  const accountCreationInFlight = useRef(false);
  const otpActionInFlight = useRef(false);
  const [registered, setRegistered] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customisingFeed, setCustomisingFeed] = useState(false);

  const { secondsLeft: resendSeconds, restart: restartResendCountdown } = useResendCountdown(RESEND_SECONDS);

  const { availabilityMessage, isAvailableMessage, isUsernameUsable, suggestions: liveSuggestions } = useUsernameAvailability(username, step === "username" && !registered);

  const canContinue = useMemo(() => {
    if (step === "contact") return isValidEmailAddress(email);
    if (step === "verify") return code.length === 6;
    if (step === "birthday") return isBirthdayValidForNewAccount(birthdayText);
    if (step === "password") return isPasswordStrongEnoughForAccount(password);
    if (step === "username") return isUsernameUsable;
    return selectedTopics.length >= MINIMUM_TOPICS_TO_CONTINUE;
  }, [step, email, code, birthdayText, password, isUsernameUsable, selectedTopics]);

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
      restartResendCountdown();
      setStep("verify");
    } catch (caught) {
      if (caught instanceof WebappRequestError && caught.code === "USERNAME_TAKEN") setConflictSuggestions(caught.suggestions ?? []);
      setError(caught instanceof WebappRequestError ? caught.message : "We couldn't send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(enteredCode: string) {
    if (enteredCode.length !== 6 || busy) return;
    await runWithAsyncActionLock(otpActionInFlight, async () => {
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
    });
  }

  async function resendCode(successMessage: string) {
    if (resendSeconds > 0 || busy) return;
    await runWithAsyncActionLock(otpActionInFlight, async () => {
      setError(null);
      setBusy(true);
      try {
        await authService.sendOneTimeCode(destination, "signup");
        restartResendCountdown();
        setMessage(successMessage);
      } catch (caught) {
        setError(caught instanceof WebappRequestError ? caught.message : "We couldn't resend the code. Please try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  async function createAccount(chosenUsername: string | undefined) {
    if (!otpToken) {
      setError("Your verification expired. Go back and request a new code.");
      return;
    }
    await runWithAsyncActionLock(accountCreationInFlight, async () => {
      setError(null);
      setConflictSuggestions([]);
      setBusy(true);
      try {
        const createdAccount = await sendRequestToWebappServer<{ user: User; csrfToken?: string }>("/auth/register", {
          method: "POST",
          body: {
            email: destination,
            ...(chosenUsername ? { username: chosenUsername } : {}),
            password,
            birthday: parseBirthdayFromDayMonthYear(birthdayText)?.toISOString().slice(0, 10) ?? "",
            otpToken,
          },
        });
        if (createdAccount.csrfToken) rememberCsrfTokenForRequests(createdAccount.csrfToken);
        setCode("");
        setOtpToken("");
        setRegistered(true);
        setStep("topics");
      } catch (caught) {
        setError(caught instanceof WebappRequestError ? caught.message : "We couldn't create your account. Please try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    try {
      await advanceSignUpStep(event);
    } finally {
      submissionInFlight.current = false;
    }
  }

  async function advanceSignUpStep(event: FormEvent<HTMLFormElement>) {
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

  const heading = describeSignUpStepHeading(step, destination, customisingFeed);

  if (step === "topics") {
    return (
      <SignUpTopicsStep
        heading={heading}
        error={error}
        isBusy={busy}
        isCustomisingFeed={customisingFeed}
        selectedTopicIds={selectedTopics}
        onToggleTopic={(topicId) => setSelectedTopics((previous) => (previous.includes(topicId) ? previous.filter((id) => id !== topicId) : [...previous, topicId]))}
        onBack={goBack}
        onSkip={() => void finishSignUp()}
        onContinue={() => void handleTopicsSubmit()}
      />
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
          <ContactStepFields email={email} onEmailChange={setEmail} saveLoginInfo={saveLoginInfo} onSaveLoginInfoChange={setSaveLoginInfo} busy={busy} canContinue={canContinue} />
        ) : null}

        {step === "verify" ? (
          <SignUpVerifyCodeStep
            code={code}
            hasError={error !== null}
            isBusy={busy}
            canContinue={canContinue}
            resendSeconds={resendSeconds}
            onCodeChange={setCode}
            onCompleteCode={(completedCode) => void verifyCode(completedCode)}
            onResend={() => void resendCode("We sent you a new code.")}
          />
        ) : null}

        {step === "birthday" ? <BirthdayStepFields birthdayText={birthdayText} onBirthdayTextChange={setBirthdayText} canContinue={canContinue} /> : null}
        {step === "password" ? <PasswordStepFields password={password} onPasswordChange={setPassword} canContinue={canContinue} /> : null}
        {step === "username" ? (
          <UsernameStepFields
            username={username}
            onUsernameChange={(next) => {
              setConflictSuggestions([]);
              setError(null);
              setUsername(next);
            }}
            suggestions={liveSuggestions.length > 0 ? liveSuggestions : conflictSuggestions}
            onSuggestionSelect={(suggestion) => {
              setConflictSuggestions([]);
              setError(null);
              setUsername(suggestion);
            }}
            error={error}
            availabilityMessage={availabilityMessage}
            isAvailableMessage={isAvailableMessage}
            busy={busy}
            canContinue={canContinue}
          />
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
