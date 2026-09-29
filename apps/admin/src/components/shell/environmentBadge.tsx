import styles from "./environmentBadge.module.css";

const environmentLabels = { production: "PRODUCTION", staging: "STAGING", development: "DEV" } as const;

export function EnvironmentBadge({ environment }: { readonly environment: keyof typeof environmentLabels }) {
  return (
    <span className={`${styles.badge} ${styles[environment]}`} title={`You are working in ${environmentLabels[environment].toLowerCase()}. Actions here affect ${environment === "production" ? "real people and real money" : "test data only"}.`}>
      {environmentLabels[environment]}
    </span>
  );
}

export function EnvironmentTape({ environment }: { readonly environment: keyof typeof environmentLabels }) {
  return <div className={`${styles.tape} ${styles[`${environment}Tape`]}`} aria-hidden />;
}
