"use client";

import { useEffect } from "react";

import { EmptyFieldErrorScene } from "@/components/errors/emptyFieldErrorScene";
import { ActionLinkStyledAsButton } from "@/components/ui/actionLink";

import styles from "./error.module.css";

interface RouteErrorBoundaryProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function RouteErrorBoundary({ error, reset }: RouteErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyFieldErrorScene
      statusCode="500"
      heading="This page didn't load."
      description="Something went wrong on our side while loading this page. Try again, or go back to the homepage."
      actions={
        <>
          <button type="button" className={styles.retryButton} onClick={reset}>
            Try again
          </button>
          <ActionLinkStyledAsButton href="/" appearance="secondary">
            Back to the homepage
          </ActionLinkStyledAsButton>
        </>
      }
    />
  );
}
