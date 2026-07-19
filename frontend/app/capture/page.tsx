"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

type Result = {
  title: string;
  summary: string;
  key_points: string[];
  cognitive_mode: string;
  actionability_score: number;
  suggested_bucket: string;
};

export default function CapturePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) {
      router.replace("/login");
      return;
    }
    setUserId(id);
    setFirstName(localStorage.getItem("first_name") ?? "");
  }, [router]);

  function logout() {
    localStorage.removeItem("dashboard_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("first_name");
    router.push("/login");
  }

  async function submitText() {
    if (!text.trim() || !userId) return;
    setStatus("processing");
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/process/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          payload_type: text.trim().startsWith("http") ? "url" : "text",
          raw_content: text.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.result) {
        setErrorMsg(data.detail ?? "Processing failed. Try again.");
        setStatus("error");
        return;
      }
      setResult(data.result);
      setStatus("done");
      setText("");
    } catch {
      setErrorMsg("Couldn't reach the server.");
      setStatus("error");
    }
  }

  async function submitVoice(file: File) {
    if (!userId) return;
    setStatus("processing");
    setErrorMsg(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("user_id", userId);
      form.append("audio_file", file);

      const res = await fetch(`${BACKEND_URL}/api/process/voice`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.result) {
        setErrorMsg(data.detail ?? "Transcription failed. Try again.");
        setStatus("error");
        return;
      }
      setResult(data.result);
      setStatus("done");
    } catch {
      setErrorMsg("Couldn't reach the server.");
      setStatus("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!userId) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Hey, ${firstName}` : "Capture"}
        </h1>
        <div className="flex gap-4 text-sm text-muted">
          <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
          <button onClick={logout} className="hover:text-white transition-colors">Sign out</button>
        </div>
      </div>
      <p className="text-muted text-sm mb-8">
        Same as Telegram: any thought, a link, or a voice note.
      </p>

      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a link, or just type a thought…"
          rows={4}
          className="w-full bg-transparent outline-none resize-none text-sm placeholder:text-muted"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <label className="text-xs text-muted hover:text-white cursor-pointer transition-colors flex items-center gap-1.5">
            🎙️ Voice note
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) submitVoice(file);
              }}
            />
          </label>
          <button
            onClick={submitText}
            disabled={!text.trim() || status === "processing"}
            className="rounded-md bg-accent text-white text-sm font-medium px-4 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {status === "processing" ? "Processing…" : "Capture"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2 mb-4">
          {errorMsg}
        </p>
      )}

      {status === "done" && result && (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-medium mb-2">✅ {result.title}</p>
          <p className="text-sm text-muted mb-3">{result.summary}</p>
          {result.key_points?.length > 0 && (
            <ul className="text-sm text-muted mb-3 pl-4 list-disc space-y-1">
              {result.key_points.map((kp, i) => (
                <li key={i}>{kp}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 flex-wrap text-xs font-mono">
            <span className="rounded bg-accent/15 text-accent px-2 py-1">📁 {result.suggested_bucket}</span>
            <span className="rounded bg-surface border border-border px-2 py-1 text-muted">🧠 {result.cognitive_mode}</span>
            <span className="rounded bg-surface border border-border px-2 py-1 text-muted">⚡ {result.actionability_score}</span>
          </div>
        </div>
      )}
    </div>
  );
}
