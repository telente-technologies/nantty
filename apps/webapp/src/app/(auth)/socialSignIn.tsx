"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { WebappRequestError } from "@/services/clientApi.service";
import { signInWithSocialProvider, type SocialSignInProvider } from "@/services/socialSignIn.service";

import formStyles from "./authForm.module.css";

export function SocialSignInButtons() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [signingInWith, setSigningInWith] = useState<SocialSignInProvider | null>(null);

  const handleSocialSignIn = async (provider: SocialSignInProvider) => {
    if (signingInWith) return;
    setNotice(null);
    setSigningInWith(provider);
    try {
      await signInWithSocialProvider(provider);
      router.push("/");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof WebappRequestError ? error.message : "Sign-in failed");
      setSigningInWith(null);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        fullWidth
        size="lg"
        leadingIcon={<AppIcon name="apple24" size={24} />}
        busy={signingInWith === "apple"}
        disabled={signingInWith !== null}
        onClick={() => handleSocialSignIn("apple")}
      >
        Continue with Apple
      </Button>
      <Button
        variant="secondary"
        fullWidth
        size="lg"
        leadingIcon={<AppIcon name="google24" size={24} />}
        busy={signingInWith === "google"}
        disabled={signingInWith !== null}
        onClick={() => handleSocialSignIn("google")}
      >
        Continue with Google
      </Button>
      {notice ? (
        <p className={formStyles.formError} role="alert">
          {notice}
        </p>
      ) : null}
    </>
  );
}
