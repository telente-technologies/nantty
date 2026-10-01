"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";

import formStyles from "../authForm.module.css";
import styles from "./welcome.module.css";

type SignUpMode = "signup" | "login";
type SocialProvider = "apple" | "google";

const PHOTO_ROWS: readonly { readonly offset: number; readonly key: string }[] = [
  { offset: -43, key: "a" },
  { offset: -96, key: "b" },
  { offset: -43, key: "c" },
];

const socialProviderNotice: Record<SocialProvider, string> = {
  apple: "Apple sign-in isn't configured yet.",
  google: "Google sign-in isn't configured yet.",
};

export default function WelcomePage() {
  const [showSplash, setShowSplash] = useState(true);
  const [mode, setMode] = useState<SignUpMode>("signup");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleSocialSignIn = (provider: SocialProvider) => {
    setNotice(socialProviderNotice[provider]);
  };

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
        <Button variant="secondary" fullWidth size="lg" leadingIcon={<AppIcon name="apple24" size={24} />} onClick={() => handleSocialSignIn("apple")}>
          Continue with Apple
        </Button>
        <Button variant="secondary" fullWidth size="lg" leadingIcon={<AppIcon name="google24" size={24} />} onClick={() => handleSocialSignIn("google")}>
          Continue with Google
        </Button>
        <Button
          variant="primary"
          fullWidth
          size="lg"
          leadingIcon={<AppIcon name="userCircle24" size={24} />}
          onClick={() => {
            setNotice(null);
            window.location.assign(mode === "login" ? "/login" : "/signup");
          }}
        >
          Use username
        </Button>
        {notice ? (
          <p className={formStyles.formError} role="alert">
            {notice}
          </p>
        ) : null}
      </div>

      <div className={styles.footer}>
        <p className={styles.legal}>
          By continuing, you agree to our <a href={`${process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com"}/terms`}>Terms of Service</a> and acknowledge you have read our{" "}
          <a href={`${process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com"}/privacy`}>Privacy Policy</a> and{" "}
          <a href={`${process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://zudomart.com"}/cookies`}>Cookie Use</a> to learn how we collect, use, and share your data.
        </p>
        <p className={formStyles.switchPrompt}>
          {mode === "login" ? "Don’t have an account?" : "Already have an account?"}{" "}
          <Link href={mode === "login" ? "/signup" : "/login"} className={formStyles.linkStrong} onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Sign up" : "Log in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
