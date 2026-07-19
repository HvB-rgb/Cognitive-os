"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    dob: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          first_name: form.firstName,
          last_name: form.lastName,
          dob: form.dob,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Something went wrong. Try again.");
        return;
      }

      localStorage.setItem("dashboard_token", data.dashboard_token);
      localStorage.setItem("user_id", data.id);
      localStorage.setItem("username", data.username);
      localStorage.setItem("first_name", form.firstName);
      setUsername(data.username);
    } catch {
      setError("Couldn't reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  if (username) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs uppercase tracking-widest text-muted mb-3">Account created</p>
          <h1 className="text-2xl font-semibold mb-2">Welcome, {form.firstName}.</h1>
          <p className="text-muted text-sm mb-6">
            Your unique ID is{" "}
            <span className="font-mono text-accent">{username}</span>
          </p>
          <button
            onClick={() => router.push("/capture")}
            className="w-full rounded-md bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90 transition-opacity"
          >
            Start capturing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Create your account</h1>
          <p className="text-muted text-sm">Your personal knowledge layer</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input
                required
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                className="input"
                placeholder="Harsh Vardhan"
              />
            </Field>
            <Field label="Last name">
              <input
                required
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                className="input"
                placeholder="Bagri"
              />
            </Field>
          </div>

          <Field label="Email">
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password">
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="input"
              placeholder="At least 8 characters"
            />
          </Field>

          <Field label="Date of birth">
            <input
              required
              type="date"
              value={form.dob}
              onChange={(e) => update("dob", e.target.value)}
              className="input"
            />
          </Field>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-xs text-muted">
            Already have an ID? <a href="/login" className="text-accent hover:underline">Sign in</a>
          </p>
        </form>
      </div>

      <style jsx global>{`
        .input {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          color: #e5e5e5;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #7c6af7;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
