import styles from "./diffView.module.css";

type JsonLike = unknown;

interface DiffRow {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly kind: "added" | "removed" | "changed" | "same";
}

function flattenIntoPaths(value: JsonLike, prefix: string, output: Map<string, string>): void {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, JsonLike>);
    if (entries.length === 0 && prefix) output.set(prefix, "{}");
    for (const [key, child] of entries) flattenIntoPaths(child, prefix ? `${prefix}.${key}` : key, output);
    return;
  }
  output.set(prefix || "value", Array.isArray(value) ? JSON.stringify(value) : value === undefined ? "" : JSON.stringify(value));
}

export function buildDiffRows(before: JsonLike, after: JsonLike): DiffRow[] {
  const beforePaths = new Map<string, string>();
  const afterPaths = new Map<string, string>();
  if (before !== null && before !== undefined) flattenIntoPaths(before, "", beforePaths);
  if (after !== null && after !== undefined) flattenIntoPaths(after, "", afterPaths);
  const allPaths = [...new Set([...beforePaths.keys(), ...afterPaths.keys()])];
  return allPaths.map((path) => {
    const beforeValue = beforePaths.get(path);
    const afterValue = afterPaths.get(path);
    const kind = beforeValue === undefined ? "added" : afterValue === undefined ? "removed" : beforeValue === afterValue ? "same" : "changed";
    return { path, before: beforeValue ?? "", after: afterValue ?? "", kind };
  });
}

export function DiffView({ before, after, isUnchangedHidden = false }: { readonly before: JsonLike; readonly after: JsonLike; readonly isUnchangedHidden?: boolean }) {
  const rows = buildDiffRows(before, after).filter((row) => !isUnchangedHidden || row.kind !== "same");
  if (rows.length === 0) return <p className={styles.empty}>No field-level changes recorded.</p>;
  return (
    <table className={styles.diff}>
      <caption className="visuallyHidden">Before and after values</caption>
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.path} className={styles[row.kind]}>
            <th scope="row">{row.path}</th>
            <td>{row.before ? <del>{row.before}</del> : <span className={styles.none}>—</span>}</td>
            <td>{row.after ? <ins>{row.after}</ins> : <span className={styles.none}>—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
