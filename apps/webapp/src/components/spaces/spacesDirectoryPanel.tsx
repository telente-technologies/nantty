import Link from "next/link";

import type { Space } from "@/services/spaces.service";

import styles from "./spaces.module.css";

export function SpacesDirectoryPanel({ spaces }: { readonly spaces: readonly Space[] }) {
  return (
    <>
      <h1>Make room for conversation</h1>
      <p className={styles.muted}>
        Drop into live audio or find your next conversation. Creators host;
        anyone can listen.
      </p>
      {spaces.length === 0 ? (
        <p>No Spaces yet. Start a conversation or check back soon.</p>
      ) : null}
      {(["live", "scheduled"] as const).map((state) => {
        const matchingSpaces = spaces.filter((space) => space.state === state);
        if (matchingSpaces.length === 0) return null;

        return (
          <section key={state}>
            <h2>{state === "live" ? "Live now" : "Upcoming"}</h2>
            {matchingSpaces.map((space) => (
              <article key={space.id} className={styles.card}>
                <div className={styles.copy}>
                  <span className={styles.pill}>
                    {state === "live" ? "LIVE AUDIO" : "SCHEDULED"}
                  </span>
                  <Link href={`/spaces/${space.id}`}>{space.title}</Link>
                  <span className={styles.muted}>
                    {space.host.name} ·{" "}
                    {state === "live"
                      ? `${space.listenerCount} listening`
                      : new Date(space.scheduledAt!).toLocaleString()}
                  </span>
                </div>
                <Link className={styles.button} href={`/spaces/${space.id}`}>
                  {state === "live" ? "Join Space" : "View Space"}
                </Link>
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}
