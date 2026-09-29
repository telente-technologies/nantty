import { posKeyboardShortcutDescriptions } from "@/constants/posShortcuts.constant";

import styles from "./posDialogs.module.css";

export function PosShortcutsList() {
  return (
    <table className={styles.shortcutTable}>
      <caption className="visuallyHidden">Register keyboard shortcuts</caption>
      <thead className="visuallyHidden">
        <tr>
          <th scope="col">Keys</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {posKeyboardShortcutDescriptions.map((shortcut) => (
          <tr key={shortcut.keys}>
            <td>
              <kbd>{shortcut.keys}</kbd>
            </td>
            <td>{shortcut.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
