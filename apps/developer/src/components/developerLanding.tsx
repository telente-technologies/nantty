import Link from "next/link";
import { NanttyWordmark, ThemeSwitcher } from "@nantty/web-kit";

import { ActivityIcon, BookOpenIcon, ChatCircleTextIcon, PlugsConnectedIcon, WarningCircleIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref, readDeveloperSupportUrl, readNanttyWebUrl } from "@/config/site.config";

import styles from "./developerLanding.module.css";

const serviceReadiness = [
  { label: "Business Messaging API", state: "Contract preview · not accepting requests", icon: ChatCircleTextIcon },
  { label: "Sandbox control plane", state: "Credentials and webhooks implemented · rollout pending", icon: PlugsConnectedIcon },
  { label: "Organization and credential services", state: "Identity routes connected · database/SSO verification pending", icon: ActivityIcon },
] as const;

const integrationSteps = [
  { title: "Review the API contract", description: "Understand scopes, consent requirements, request limits, and webhook events before building." },
  { title: "Create an organization and application", description: "Organization and application workflows are connected to Identity; the combined signed-in portal workflow is still being verified." },
  { title: "Test in an isolated sandbox", description: "The Sandbox service supports isolated synthetic conversations, test credentials, and signed webhook delivery when its dedicated database and encryption key are configured." },
] as const;

export function DeveloperLanding() {
  return (
    <div className={`${styles.site} nanttyPortalTheme`}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Nantty Developers home"><NanttyWordmark height={26} /></Link>
        <nav className={styles.nav} aria-label="Developer resources">
          <Link href={readDeveloperDocsHref("business-messaging")}>Messaging API</Link>
          <Link href={readDeveloperDocsHref()}>Platform readiness</Link>
          <Link href="/dashboard">Workspace preview</Link>
        </nav>
        <ThemeSwitcher iconOnly label="Colour theme" />
        <details className={styles.mobileNav}>
          <summary><span className={styles.srOnly}>Open developer navigation</span><span aria-hidden="true">Menu</span></summary>
          <nav aria-label="Developer resources">
            <Link href={readDeveloperDocsHref("business-messaging")}>Messaging API</Link>
            <Link href={readDeveloperDocsHref()}>Platform readiness</Link>
            <Link href="/dashboard">Workspace preview</Link>
          </nav>
        </details>
      </header>

      <main id="main-content" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="developer-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Nantty for Developers</p>
            <h1 id="developer-title">Build business integrations around conversations.</h1>
            <p className={styles.intro}>Review the Business Messaging contract and use the staged organization, test-credential, and Sandbox webhook workflows. Production business API traffic, billing, and production credentials remain unavailable.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href={readDeveloperDocsHref("business-messaging")}>Read the contract preview</Link>
              <Link className={styles.secondaryAction} href="/dashboard">View workspace readiness</Link>
            </div>
          </div>
          <aside className={styles.statusPanel} aria-labelledby="readiness-title">
            <div className={styles.statusHeading}>
              <WarningCircleIcon size={19} />
              <div><h2 id="readiness-title">Platform readiness</h2><p>Current integration status</p></div>
            </div>
            <ul className={styles.statusList}>
              {serviceReadiness.map(({ label, state, icon: Icon }) => (
                <li key={label}>
                  <Icon size={19} className={styles.statusIcon} />
                  <span><strong>{label}</strong><small>{state}</small></span>
                </li>
              ))}
            </ul>
            <p className={styles.pricingNote}>Developer plans and pricing are not published yet. No subscription or usage purchase is available from this preview.</p>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="start-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Before launch</p>
            <h2 id="start-title">A clear path from review to production</h2>
            <p>Each step depends on real identity, authorization, and isolated test services. This page does not create mock applications or credentials.</p>
          </div>
          <ol className={styles.steps}>
            {integrationSteps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.privacy} aria-labelledby="privacy-title">
          <BookOpenIcon size={22} />
          <div><h2 id="privacy-title">Personal Nantty conversations stay private</h2><p>The proposed Business Messaging API is a separate, consented integration surface. It does not provide access to personal conversations or bypass their encryption.</p></div>
          <Link href={readDeveloperDocsHref("business-messaging")}>Review the privacy boundary</Link>
        </section>
      </main>

      <footer className={`${styles.footer} nanttyPortalFooter`}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <Link href="/" aria-label="Nantty Developers home"><NanttyWordmark height={26} tone="onDark" /></Link>
            <p>Developer access is in preview. Review the contract before planning an integration.</p>
          </div>
          <nav className={styles.footerGroups} aria-label="Developer footer">
            <div><h2>Build</h2><Link href={readDeveloperDocsHref()}>API documentation</Link><Link href={readDeveloperDocsHref("business-messaging")}>Business messaging</Link><Link href="/dashboard">Workspace</Link></div>
            <div><h2>Help and legal</h2><Link href={readDeveloperSupportUrl()}>Developer support</Link><a href={new URL("/terms", readNanttyWebUrl()).toString()}>Terms</a><a href={new URL("/privacy", readNanttyWebUrl()).toString()}>Privacy</a></div>
            <div><h2>Nantty</h2><a href={new URL("/cookies", readNanttyWebUrl()).toString()}>Cookies</a><a href={readNanttyWebUrl()}>Nantty home</a></div>
          </nav>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Nantty</span><span>API access, credentials, billing, and sandbox execution are not available in this preview.</span></div>
        <p className={`${styles.footerWordmark} nanttyPortalFooterWordmark`} aria-hidden="true">Nantty</p>
      </footer>
    </div>
  );
}
