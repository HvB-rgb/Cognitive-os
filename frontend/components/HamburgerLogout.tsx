"use client";

import { useRouter } from "next/navigation";

/** Server-Component pages (dashboard/review/graph) resolve the signed-in
 * user from an httpOnly dashboard_token cookie, not localStorage — both
 * need to be cleared here for a real sign-out. */
export default function HamburgerLogout({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    localStorage.removeItem("dashboard_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("first_name");
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <span className={className} onClick={logout} title="Sign out">
      ☰
    </span>
  );
}
