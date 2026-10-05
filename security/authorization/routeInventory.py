#!/usr/bin/env python3
# Test name: route inventory and gateway exposure diff (static, read-only)
# Target: source tree only (Go chi/ServeMux routes, TS routers, FastAPI routes, gateway route table)
# Expected behavior: every backend route is either hidden (internal), routed with matching auth, or deliberately unrouted
# Dangerous behavior: admin/internal route reachable through the gateway without a backend guard; mutation with no auth
# Cleanup: none (writes only the markdown report passed as argv[1], default stdout)
# Financial safety: SAFE - no network, no database, no provider calls
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GO_DEPLOYABLE = {"auth": "identity", "users": "identity", "admin": "identity", "currency": "identity", "payments": "money", "wallet": "money", "ledger": "money",
                 "escrow": "money", "subscriptions": "money", "creators": "money", "moderation": "trust", "catalog": "commerce", "inventory": "commerce",
                 "orders": "commerce", "analytics": "commerce", "live": "live", "ads": "ads"}
TS_SERVICES = ["social", "media", "search", "notifications", "support"]
MUTATING = {"POST", "PUT", "PATCH", "DELETE"}


def classify_go(wrapper: str) -> str:
    lowered = wrapper.lower()
    if "internal" in lowered:
        return "internal-token"
    if any(word in lowered for word in ("staff", "guard.", "reviewer", "editor", "requirepermission", "requireadmin", "middlewares.admin(")):
        return "staff"
    if "optional" in lowered:
        return "optional-user"
    if any(word in lowered for word in ("accesstoken", "user(", "requireuser", "authenticated", "principal", "seller", "member", "idempotent(", "owner")):
        return "user"
    return "none-in-route (controller may self-check)"


def go_routes():
    pattern = re.compile(r'mux\.Handle(?:Func)?\("([A-Z]+) ([^"]+)",\s*(.*)$')
    for path in (ROOT / "services/go/modules").rglob("*.routes.go"):
        module = path.relative_to(ROOT / "services/go/modules").parts[0]
        source = path.read_text().splitlines()
        definitions = {}
        for index, line in enumerate(source):
            found = re.match(r"\s*(\w+)\s*:?=\s*(.*)$", line)
            if found:
                definitions[found[1]] = " ".join([found[2], *source[index + 1:index + 3]]) if found[2].rstrip().endswith("{") else found[2]
        for number, line in enumerate(source, 1):
            match = pattern.search(line)
            if match:
                head = re.match(r"\s*(\w+)", match[3])
                context = match[3] + " " + definitions.get(head[1] if head else "", "")
                yield {"method": match[1], "path": match[2], "auth": classify_go(context), "upstream": GO_DEPLOYABLE.get(module, "?"),
                       "source": f"{path.relative_to(ROOT)}:{number}"}


def ts_routes():
    pattern = re.compile(r'router\.(get|post|put|patch|delete)\("([^"]+)"')
    for service in TS_SERVICES:
        for path in (ROOT / f"services/typescript/{service}/src").rglob("*.ts"):
            for number, line in enumerate(path.read_text().splitlines(), 1):
                match = pattern.search(line)
                if match:
                    yield {"method": match[1].upper(), "path": match[2], "auth": "see controller", "upstream": service, "source": f"{path.relative_to(ROOT)}:{number}"}


def python_routes():
    prefix_pattern = re.compile(r'APIRouter\(prefix="([^"]*)"')
    route_pattern = re.compile(r'add_api_route\(\s*"([^"]+)"[^)]*?methods=\["([A-Z]+)"\]', re.S)
    for path in (ROOT / "services/python/intelligence/src").rglob("*_routes.py"):
        text = path.read_text()
        prefix = (prefix_pattern.search(text) or [None, ""])[1]
        for match in route_pattern.finditer(text):
            yield {"method": match[2], "path": prefix + match[1], "auth": "request signature (internal only)", "upstream": "intelligence", "source": str(path.relative_to(ROOT))}


def gateway_routes():
    text = (ROOT / "services/typescript/gateway/src/routes/upstream.routes.ts").read_text()
    for line in text.splitlines():
        prefix = re.search(r'pathPrefix: "([^"]+)"', line)
        if not prefix:
            continue
        methods = re.search(r'methods: \[([^\]]+)\]', line)
        yield {"prefix": prefix[1], "upstream": re.search(r'upstream: "([^"]+)"', line)[1], "auth": re.search(r'authentication: "([^"]+)"', line)[1],
               "methods": None if not methods else re.findall(r'"([A-Z]+)"', methods[1]), "exact": "exactPathOnly: true" in line}


def matches(path: str, route_path: str) -> bool:
    if "*" in route_path:
        left, right = route_path.split("/"), path.split("/")
        return len(left) == len(right) and all((segment == "*" and value != "") or segment == value for segment, value in zip(left, right))
    return path == route_path or path.startswith(route_path if route_path.endswith("/") else route_path + "/")


def resolve(method: str, path: str, routes):
    for route in routes:
        hit = (path == route["prefix"] or (matches(path, route["prefix"]) and "*" in route["prefix"])) if route["exact"] else matches(path, route["prefix"])
        if hit and (route["methods"] is None or method in route["methods"]):
            return route
    return None


def sample(path: str) -> str:
    return re.sub(r"\{[^}]+\}|:[A-Za-z]+", "x1", path).split("?")[0]


def assess(route, gateway):
    concrete = sample(route["path"])
    if any(segment.lower() == "internal" for segment in concrete.split("/")):
        return "hidden (internal segment blocked at gateway)"
    if route["path"] in ("/healthz", "/readyz", "/metrics") or route["path"].startswith("/health"):
        return "ops endpoint (not routed)" if gateway is None else "ops endpoint ROUTED"
    if gateway is None:
        return "UNROUTED"
    notes = []
    if gateway["upstream"] != route["upstream"]:
        notes.append(f"UPSTREAM MISMATCH (gateway->{gateway['upstream']})")
    if "/admin/" in concrete and route["auth"] not in ("staff", "see controller"):
        notes.append("ADMIN PATH WITHOUT STAFF GUARD IN ROUTE")
    if gateway["auth"] == "optional" and route["method"] in MUTATING and route["auth"].startswith("none") and "webhook" not in concrete:
        notes.append("OPTIONAL-AUTH MUTATION, NO ROUTE GUARD")
    return "; ".join(notes) or f"routed ({gateway['auth']})"


def main():
    gateway = list(gateway_routes())
    rows = [*go_routes(), *ts_routes(), *python_routes()]
    lines = ["| Method | Path | Service | Route auth | Gateway | Source |", "|---|---|---|---|---|---|"]
    counts = {}
    for route in sorted(rows, key=lambda row: (row["upstream"], row["path"], row["method"])):
        match = None if route["upstream"] == "intelligence" else resolve(route["method"], sample(route["path"]), gateway)
        verdict = assess(route, match)
        key = verdict.split(" (")[0].split(";")[0]
        counts[key] = counts.get(key, 0) + 1
        lines.append(f"| {route['method']} | `{route['path']}` | {route['upstream']} | {route['auth']} | {verdict} | {route['source']} |")
    summary = ["| Verdict | Routes |", "|---|---|", *[f"| {key} | {value} |" for key, value in sorted(counts.items(), key=lambda item: -item[1])]]
    output = "\n".join(["## Summary", "", *summary, "", f"Total backend routes: {len(rows)}; gateway route entries: {len(gateway)}", "", "## Full inventory", "", *lines, ""])
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(output)
    else:
        print(output)


if __name__ == "__main__":
    main()
