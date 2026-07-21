"use client";

import { useRouter } from "next/navigation";

/** Server-Component pages (direct-to-Supabase, service key) have no
 * concept of "who's logged in" — that only exists client-side in
 * localStorage (set by /login and /signup). This is the one piece that
 * needs to run in the browser to clear it and sign out. */
export default function HamburgerLogout({ className }: { className?: string }) {
  const router = useRouter();

  function logout() {
    localStorage.removeItem("dashboard_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("first_name");
    router.push("/login");
  }

  return (
    <span className={className} onClick={logout} title="Sign out">
      ☰
    </span>
  );
}
