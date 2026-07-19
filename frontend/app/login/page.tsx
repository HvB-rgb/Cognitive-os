"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Something went wrong. Try again.");
        return;
      }

      localStorage.setItem("dashboard_token", data.dashboard_token);
      localStorage.setItem("user_id", data.id);
      localStorage.setItem("username", data.username);
      localStorage.setItem("first_name", data.first_name);
      router.push("/capture");
    } catch {
      setError("Couldn't reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Sign in</h1>
          <p className="text-muted text-sm">Enter your unique ID — nothing else.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Your ID</span>
            <input
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              placeholder="HVB_2108"
            />
          </label>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="mt-2 w-full rounded-md bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs text-muted">
            No account? <a href="/signup" className="text-accent hover:underline">Create one</a>
          </p>
        </form>
      </div>

      <style jsx global>{`
        .login-input {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          font-family: "JetBrains Mono", monospace;
          letter-spacing: 0.02em;
          color: #e5e5e5;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
        }
        .login-input:focus {
          border-color: #7c6af7;
        }
      `}</style>
    </div>
  );
}
