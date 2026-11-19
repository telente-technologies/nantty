import type { ReactNode } from "react";

export function SsoSignInButton({ className, children }: { readonly className?: string; readonly children: ReactNode }) {
  return (
    <form action="/api/auth/login" method="get" style={{ display: "contents" }}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
