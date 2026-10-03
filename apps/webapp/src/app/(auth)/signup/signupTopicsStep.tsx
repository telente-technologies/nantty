"use client";

import { useQuery } from "@tanstack/react-query";

import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { authService } from "@/services/auth.service";

import stepStyles from "../authSteps.module.css";
import styles from "../authForm.module.css";
import { MINIMUM_TOPICS_TO_CONTINUE, type SignUpHeading } from "./signupRules.util";

interface SignUpTopicsStepProps {
  readonly heading: SignUpHeading;
  readonly error: string | null;
  readonly isBusy: boolean;
  readonly isCustomisingFeed: boolean;
  readonly selectedTopicIds: readonly string[];
  readonly onToggleTopic: (topicId: string) => void;
  readonly onBack: () => void;
  readonly onSkip: () => void;
  readonly onContinue: () => void;
}

export function SignUpTopicsStep({ heading, error, isBusy, isCustomisingFeed, selectedTopicIds, onToggleTopic, onBack, onSkip, onContinue }: SignUpTopicsStepProps) {
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: () => authService.fetchPersonalizationTopics(), retry: false });

  return (
    <div>
      <div className={styles.topBar}>
        <button type="button" className={styles.backButton} aria-label="Go back" onClick={onBack}>
          <AppIcon name="arrowLeft24" size={24} />
        </button>
        <button type="button" className={styles.skipButton} disabled={isBusy || isCustomisingFeed} onClick={onSkip}>
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

      {isCustomisingFeed ? (
        <p className={stepStyles.customisingNote}>
          <Spinner label="Customizing your feed" />
        </p>
      ) : topicsQuery.isLoading ? (
        <Spinner label="Loading topics" />
      ) : (
        <div className={stepStyles.topicGrid} role="group" aria-label="Choose your interests">
          {(topicsQuery.data ?? []).map((topic) => {
            const active = selectedTopicIds.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                className={active ? `${stepStyles.topicChip} ${stepStyles.topicChipActive}` : stepStyles.topicChip}
                aria-pressed={active}
                onClick={() => onToggleTopic(topic.id)}
              >
                {topic.name}
              </button>
            );
          })}
        </div>
      )}

      {isCustomisingFeed ? null : (
        <div className={styles.stack} style={{ marginTop: "var(--space-6)" }}>
          <Button type="button" fullWidth size="lg" onClick={onContinue} disabled={selectedTopicIds.length < MINIMUM_TOPICS_TO_CONTINUE}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
