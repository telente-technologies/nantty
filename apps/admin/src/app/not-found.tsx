import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 48 }}>
      <h1>Page not found</h1>
      <p>
        This admin page does not exist. <Link href="/">Go to your start page</Link>.
      </p>
    </main>
  );
}
