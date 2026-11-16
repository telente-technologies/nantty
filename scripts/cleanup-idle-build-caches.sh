#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
GIT_ROOT="$(git -C "$PROJECT_ROOT" rev-parse --show-toplevel)"
DRY_RUN=false

case "${1:-}" in
    "") ;;
    --dry-run) DRY_RUN=true ;;
    --help)
        printf 'Usage: %s [--dry-run]\n' "${0##*/}"
        exit 0
        ;;
    *)
        printf 'Unknown option: %s\n' "$1" >&2
        exit 2
        ;;
esac

if [[ "$GIT_ROOT" != "$PROJECT_ROOT" ]]; then
    echo "Refusing cleanup: script is not at the repository root."
    exit 1
fi

runtime_dir="${XDG_RUNTIME_DIR:-/tmp}"
lock_file="$runtime_dir/nantty-build-cache-cleanup-${UID}.lock"
exec 9>"$lock_file"
if ! flock -n 9; then
    echo "Another Nantty cache cleanup is already running; skipping."
    exit 0
fi

has_active_project_tool() {
    local proc_dir pid process_cwd command_line
    for proc_dir in /proc/[0-9]*; do
        pid="${proc_dir##*/}"
        [[ "$pid" == "$$" || "$pid" == "$PPID" ]] && continue
        [[ -r "$proc_dir/cmdline" ]] || continue
        process_cwd="$(readlink -f "$proc_dir/cwd" 2>/dev/null || true)"
        command_line="$(tr '\0' ' ' < "$proc_dir/cmdline" 2>/dev/null || true)"
        if [[ "$process_cwd" != "$PROJECT_ROOT" && "$process_cwd" != "$PROJECT_ROOT/"* && "$command_line" != *"$PROJECT_ROOT"* ]]; then
            continue
        fi
        case "$command_line" in
            *"playwright"*"test-server"*) continue ;;
            *"next dev"*|*"next build"*|*"next start"*|*"next-server"*|*"vite"*|*"webpack"*|*"metro"*|*"expo start"*|*"playwright"*|*"jest"*|*"vitest"*|*"pnpm"*|*"npm run"*|*"yarn"*|*"bun run"*|*"xcodebuild"*|*"swift build"*)
                return 0
                ;;
        esac
    done
    return 1
}

if has_active_project_tool; then
    echo "A build, test, or app process is active in this repository; skipping cache cleanup."
    exit 0
fi

cache_paths=(
    "$PROJECT_ROOT/apps/webapp/.next"
    "$PROJECT_ROOT/apps/web/.next"
    "$PROJECT_ROOT/apps/seller/.next"
    "$PROJECT_ROOT/apps/studio/.next"
    "$PROJECT_ROOT/apps/ads/.next"
    "$PROJECT_ROOT/apps/mobile/.expo"
)

for cache_path in "${cache_paths[@]}"; do
    resolved_path="$(realpath -m -- "$cache_path")"
    [[ "$resolved_path" == "$PROJECT_ROOT/"* ]] || { echo "Refusing unexpected cache path."; exit 1; }
done

freed_bytes=0
for cache_path in "${cache_paths[@]}"; do
    [[ -d "$cache_path" ]] || continue
    # Check again immediately before removal in case an app started after preflight.
    if has_active_project_tool; then
        echo "A build, test, or app process started during cleanup; stopping."
        exit 0
    fi
    cache_bytes="$(du -sb -- "$cache_path" | awk '{print $1}')"
    if [[ "$DRY_RUN" == true ]]; then
        printf 'Would remove %s (%s bytes)\n' "${cache_path#"$PROJECT_ROOT"/}" "$cache_bytes"
        freed_bytes=$((freed_bytes + cache_bytes))
        continue
    fi
    rm -r -- "$cache_path"
    freed_bytes=$((freed_bytes + cache_bytes))
done

if [[ "$DRY_RUN" == true ]]; then
    printf 'Dry run complete; approximately %s bytes would be freed.\n' "$freed_bytes"
else
    printf 'Removed idle, regenerable project build caches; approximately %s bytes freed.\n' "$freed_bytes"
fi
