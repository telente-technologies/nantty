"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CopyIcon, LockKeyIcon, ShieldCheckIcon, TerminalWindowIcon } from "@/components/ui/icons";
import { readDeveloperDocsHref, readSandboxPortalUrl } from "@/config/site.config";

import {
  apiReferenceEndpoints,
  type ApiEndpointDoc,
  type EndpointFieldSpec,
  type SampleLanguage,
} from "./apiReferenceData";
import styles from "./apiReferenceExplorer.module.css";

const languageLabels: Readonly<Record<SampleLanguage, string>> = {
  curl: "cURL",
  node: "Node.js",
  python: "Python",
  go: "Go",
};

function FieldSpecList({ title, fields }: { readonly title: string; readonly fields: readonly EndpointFieldSpec[] }) {
  return (
    <section className={styles.specSection}>
      <h3 className={styles.specHeading}>{title}</h3>
      <ul className={styles.specList}>
        {fields.map((field) => (
          <li key={field.name} className={styles.specRow}>
            <div className={styles.specMeta}>
              <code className={styles.fieldName}>{field.name}</code>
              <span className={styles.fieldType}>{field.type}</span>
              {field.required ? <span className={styles.requiredPill}>required</span> : <span className={styles.optionalPill}>optional</span>}
              {field.constraints ? <code className={styles.constraintPill}>{field.constraints}</code> : null}
            </div>
            <p className={styles.fieldDesc}>{field.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NumberedCode({ code }: { readonly code: string }) {
  const lines = code.split("\n");
  return (
    <pre className={styles.codeBlock}>
      <code>
        {lines.map((line, index) => (
          <span key={index} className={styles.codeLine}>
            <span className={styles.lineNum} aria-hidden="true">{index + 1}</span>
            <span className={styles.lineText}>{line || " "}</span>
          </span>
        ))}
      </code>
    </pre>
  );
}

export function ApiReferenceExplorer({ initialEndpointId }: { readonly initialEndpointId?: string }) {
  const defaultEndpoint = apiReferenceEndpoints[2] ?? apiReferenceEndpoints[0]!;
  const [groupFilter, setGroupFilter] = useState<"ALL" | ApiEndpointDoc["group"]>("ALL");
  const [selectedId, setSelectedId] = useState<string>(initialEndpointId ?? defaultEndpoint.id);
  const [language, setLanguage] = useState<SampleLanguage>("curl");
  const [selectedStatus, setSelectedStatus] = useState<number>(defaultEndpoint.responses[0]!.status);
  const [copiedKey, setCopiedKey] = useState<"" | "url" | "request" | "response">("");

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace(/^#/, "").trim();
      if (!hash) return;
      const match = apiReferenceEndpoints.find((ep) => ep.id === hash);
      if (match) {
        setSelectedId(match.id);
        setSelectedStatus(match.responses[0]!.status);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const visibleEndpoints = useMemo(
    () => (groupFilter === "ALL" ? apiReferenceEndpoints : apiReferenceEndpoints.filter((ep) => ep.group === groupFilter)),
    [groupFilter],
  );

  const endpointIndex = useMemo(
    () => Math.max(0, apiReferenceEndpoints.findIndex((ep) => ep.id === selectedId)),
    [selectedId],
  );
  const endpoint: ApiEndpointDoc = apiReferenceEndpoints[endpointIndex] ?? defaultEndpoint;

  const activeResponse = useMemo(
    () => endpoint.responses.find((r) => r.status === selectedStatus) ?? endpoint.responses[0]!,
    [endpoint, selectedStatus],
  );

  const prevEndpoint = endpointIndex > 0 ? apiReferenceEndpoints[endpointIndex - 1] ?? null : null;
  const nextEndpoint = endpointIndex < apiReferenceEndpoints.length - 1 ? apiReferenceEndpoints[endpointIndex + 1] ?? null : null;

  function chooseEndpoint(ep: ApiEndpointDoc) {
    setSelectedId(ep.id);
    setSelectedStatus(ep.responses[0]!.status);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${ep.id}`);
    }
  }

  async function copyText(kind: "url" | "request" | "response", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(kind);
      window.setTimeout(() => setCopiedKey(""), 1800);
    } catch {
      // Ignore clipboard failure in headless/restricted browsers.
    }
  }

  const fullUrl = `${endpoint.baseUrl}${endpoint.path}`;
  const formattedResponseJson = JSON.stringify(activeResponse.body, null, 2);

  return (
    <div className={styles.explorerRoot}>
      <section className={styles.selectorBar} aria-label="API endpoints">
        <div className={styles.filterRow}>
          <div className={styles.filterPills} role="tablist" aria-label="Endpoint groups">
            {(["ALL", "Sandbox Messaging", "Production Business Messaging", "Webhooks & Security"] as const).map((group) => (
              <button
                key={group}
                type="button"
                role="tab"
                aria-selected={groupFilter === group}
                className={`${styles.filterPill} ${groupFilter === group ? styles.filterPillActive : ""}`}
                onClick={() => setGroupFilter(group)}
              >
                {group === "ALL" ? "All endpoints" : group}
              </button>
            ))}
          </div>
          <Link className={styles.openApiLink} href={readDeveloperDocsHref("openapi.json")}>
            OpenAPI 3.1 JSON
          </Link>
        </div>

        <div className={styles.endpointStrip} role="list">
          {visibleEndpoints.map((item) => {
            const active = item.id === endpoint.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.endpointTab} ${active ? styles.endpointTabActive : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => chooseEndpoint(item)}
              >
                <span className={`${styles.methodBadge} ${item.method === "GET" ? styles.methodGet : styles.methodPost}`}>
                  {item.method}
                </span>
                <span className={styles.endpointTabTitle}>{item.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.referenceGrid}>
        <article className={styles.specColumn} aria-labelledby="endpoint-title">
          <div className={styles.breadcrumbRow}>
            <span className={styles.breadcrumb}>{endpoint.group}</span>
            <span className={styles.updatedTag}>Updated {endpoint.updatedAt}</span>
          </div>

          <div className={styles.titleRow}>
            <h2 id="endpoint-title" className={styles.endpointTitle}>{endpoint.title}</h2>
            <span
              className={`${styles.statusBadge} ${
                endpoint.statusTone === "live"
                  ? styles.statusLive
                  : endpoint.statusTone === "read"
                    ? styles.statusRead
                    : styles.statusPreview
              }`}
            >
              {endpoint.statusLabel}
            </span>
          </div>

          <p className={styles.endpointSummary}>{endpoint.summary}</p>

          <div className={styles.urlBar}>
            <span className={`${styles.methodBadge} ${endpoint.method === "GET" ? styles.methodGet : styles.methodPost}`}>
              {endpoint.method}
            </span>
            <code className={styles.urlCode}>{fullUrl}</code>
            <button
              type="button"
              className={styles.copyIconBtn}
              onClick={() => void copyText("url", fullUrl)}
              aria-label="Copy endpoint URL"
            >
              {copiedKey === "url" ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              <span>{copiedKey === "url" ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <section className={styles.authCard} aria-label="Authorization">
            <div className={styles.authCardHead}>
              <LockKeyIcon size={16} />
              <strong>Authorizations</strong>
            </div>
            <div className={styles.authDetails}>
              <div><span>Credential</span><code>{endpoint.authLabel}</code></div>
              <div><span>Scopes</span><code>{endpoint.scopes.join(", ")}</code></div>
            </div>
          </section>

          <FieldSpecList title="Headers" fields={endpoint.headers} />
          {endpoint.pathParams?.length ? <FieldSpecList title="Path Parameters" fields={endpoint.pathParams} /> : null}
          {endpoint.queryParams?.length ? <FieldSpecList title="Query Parameters" fields={endpoint.queryParams} /> : null}
          {endpoint.bodyParams?.length ? <FieldSpecList title="Body Parameters" fields={endpoint.bodyParams} /> : null}

          <section className={styles.specSection} aria-label="Status codes">
            <h3 className={styles.specHeading}>Responses &amp; Status Codes</h3>
            <p className={styles.specSubcopy}>Select any status below to inspect its headers and sample JSON payload in the response studio.</p>
            <div className={styles.statusCards}>
              {endpoint.responses.map((resp) => {
                const isSelected = resp.status === activeResponse.status;
                return (
                  <button
                    key={resp.status}
                    type="button"
                    className={`${styles.statusListRow} ${isSelected ? styles.statusListRowActive : ""}`}
                    onClick={() => setSelectedStatus(resp.status)}
                  >
                    <span
                      className={`${styles.httpCodePill} ${
                        resp.tone === "success"
                          ? styles.codeSuccess
                          : resp.tone === "warn"
                            ? styles.codeWarn
                            : styles.codeDanger
                      }`}
                    >
                      {resp.status}
                    </span>
                    <span className={styles.statusListCopy}>
                      <strong>{resp.label}</strong>
                      <small>{resp.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <nav className={styles.pager} aria-label="Endpoint pagination">
            {prevEndpoint ? (
              <button type="button" className={styles.pagerCard} onClick={() => chooseEndpoint(prevEndpoint)}>
                <span className={styles.pagerDir}><ArrowLeftIcon size={14} /> Previous</span>
                <strong>{prevEndpoint.title}</strong>
              </button>
            ) : <span />}
            {nextEndpoint ? (
              <button type="button" className={`${styles.pagerCard} ${styles.pagerNext}`} onClick={() => chooseEndpoint(nextEndpoint)}>
                <span className={styles.pagerDir}>Next <ArrowRightIcon size={14} /></span>
                <strong>{nextEndpoint.title}</strong>
              </button>
            ) : null}
          </nav>
        </article>

        <aside className={styles.studioColumn} aria-label="Code and response samples">
          <div className={styles.studioCard}>
            <div className={styles.studioHeader}>
              <div className={styles.studioTitleWrap}>
                <TerminalWindowIcon size={16} />
                <span>Request Sample</span>
              </div>
              <div className={styles.langTabs} role="tablist" aria-label="Code language">
                {(Object.keys(languageLabels) as SampleLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="tab"
                    aria-selected={language === lang}
                    className={`${styles.langTab} ${language === lang ? styles.langTabActive : ""}`}
                    onClick={() => setLanguage(lang)}
                  >
                    {languageLabels[lang]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.studioToolbar}>
              <code>{endpoint.method} {endpoint.path}</code>
              <div className={styles.studioToolbarActions}>
                <button type="button" className={styles.studioActionBtn} onClick={() => void copyText("request", endpoint.samples[language])}>
                  {copiedKey === "request" ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                  <span>{copiedKey === "request" ? "Copied" : "Copy"}</span>
                </button>
                <a className={styles.tryBtn} href={`${readSandboxPortalUrl()}/explorer`}>
                  Try in Sandbox ↗
                </a>
              </div>
            </div>

            <NumberedCode code={endpoint.samples[language]} />
          </div>

          <div className={styles.studioCard}>
            <div className={styles.studioHeader}>
              <div className={styles.studioTitleWrap}>
                <ShieldCheckIcon size={16} />
                <span>Response Samples</span>
              </div>
              <div className={styles.responseTabs} role="tablist" aria-label="HTTP status codes">
                {endpoint.responses.map((resp) => {
                  const active = resp.status === activeResponse.status;
                  return (
                    <button
                      key={resp.status}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`${styles.statusTab} ${active ? styles.statusTabActive : ""} ${
                        resp.tone === "success"
                          ? styles.statusTabSuccess
                          : resp.tone === "warn"
                            ? styles.statusTabWarn
                            : styles.statusTabDanger
                      }`}
                      onClick={() => setSelectedStatus(resp.status)}
                    >
                      <span className={styles.statusDot} aria-hidden="true" />
                      {resp.status}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.responseMeta}>
              <span className={styles.responseSummaryText}>{activeResponse.description}</span>
              <button type="button" className={styles.studioActionBtn} onClick={() => void copyText("response", formattedResponseJson)}>
                {copiedKey === "response" ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                <span>{copiedKey === "response" ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>

            <div className={styles.responseHeaders}>
              {Object.entries(activeResponse.headers).map(([key, value]) => (
                <div key={key}><span>{key}:</span> <code>{value}</code></div>
              ))}
            </div>

            <NumberedCode code={formattedResponseJson} />
          </div>
        </aside>
      </div>
    </div>
  );
}
