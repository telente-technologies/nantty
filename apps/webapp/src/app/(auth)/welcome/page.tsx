"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";

import { SocialSignInButtons } from "../socialSignIn";
import formStyles from "../authForm.module.css";
import styles from "./welcome.module.css";

type SignUpMode = "signup" | "login";

const PHOTO_ROWS: readonly { readonly offset: number; readonly key: string }[] = [
  { offset: -43, key: "a" },
  { offset: -96, key: "b" },
  { offset: -43, key: "c" },
];

export default function WelcomePage() {
  const [showSplash, setShowSplash] = useState(true);
  const [mode, setMode] = useState<SignUpMode>("signup");

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      {showSplash ? (
        <div className={styles.splash} role="status" aria-label="Zudomart">
          <span className={styles.splashWordmark}>zudomart</span>
        </div>
      ) : null}

      <div className={styles.photoRows} aria-hidden="true">
        {PHOTO_ROWS.map((row) => (
          <div key={row.key} className={styles.photoRow} style={{ marginLeft: row.offset }}>
            {Array.from({ length: 5 }, (_, index) => (
              <Image
                key={index}
                src="/onboardingMarketPhoto.jpg"
                alt=""
                width={100}
                height={56}
                className={styles.photo}
                sizes="100px"
              />
            ))}
          </div>
        ))}
      </div>

      <div className={styles.heading}>
        <h1 className={styles.title}>Discover real sellers around you</h1>
        <p className={styles.subtitle}>Shop real sellers, pay safely with escrow.</p>
      </div>

      <div className={styles.buttons}>
        <SocialSignInButtons />
        <Button
          variant="primary"
          fullWidth
          size="lg"
          leadingIcon={<AppIcon name="userCircle24" size={24} />}
          onClick={() => {
            window.location.assign(mode === "login" ? "/login" : "/signup");
          }}
        >
          {mode === "login" ? "Use email/username" : "Email"}
        </Button>
      </div>

      <div className={styles.footer}>
        <p className={styles.legal}>
          By continuing, you agree to our <a href={`${process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com"}/terms`}>Terms of Service</a> and acknowledge you have read our{" "}
          <a href={`${process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com"}/privacy`}>Privacy Policy</a> and{" "}
          <a href={`${process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com"}/cookies`}>Cookie Use</a> to learn how we collect, use, and share your data.
        </p>
        <p className={formStyles.switchPrompt}>
          {mode === "login" ? "Don’t have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            className={`${formStyles.linkStrong} ${formStyles.linkButton}`}
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
