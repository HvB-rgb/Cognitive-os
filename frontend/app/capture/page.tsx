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
    <>
      <div className="topbar">
        <img className="logo" src="/logo.png" alt="Cognitive OS" />
        <div className="navbtns">
          <a className="active">Capture</a>
          <a onClick={() => router.push("/dashboard")}>Entries</a>
          <a onClick={() => router.push("/graph")}>Graph</a>
          <a onClick={() => router.push("/insight")}>Insight</a>
          <a onClick={() => router.push("/review")}>Review</a>
          <span className="hamb" onClick={logout} title="Sign out">
            ☰
          </span>
        </div>
      </div>

      <div className="page-bg">
        <img className="float-mark fm-l1" src="/logo.png" alt="" style={{ "--end-op": 0.14 } as React.CSSProperties} />
        <img className="float-mark fm-l2" src="/logo.png" alt="" style={{ "--end-op": 0.22 } as React.CSSProperties} />
        <img className="float-mark fm-r1" src="/logo.png" alt="" style={{ "--end-op": 0.14 } as React.CSSProperties} />
        <img className="float-mark fm-r2" src="/logo.png" alt="" style={{ "--end-op": 0.2 } as React.CSSProperties} />
        <div className="wrap">
          <h1 className="h1">{firstName ? `Hey, ${firstName}` : "Capture"}</h1>
          <p className="sub">Same as Telegram: any thought, a link, or a voice note.</p>

          <div className="card">
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a link, or just type a thought…"
            />
            <div className="card-foot">
              <label className="voice">
                🎙️ Voice note
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) submitVoice(file);
                  }}
                />
              </label>
              <button
                className="btn capture-btn"
                onClick={submitText}
                disabled={!text.trim() || status === "processing"}
              >
                {status === "processing" ? "Processing…" : "Capture"}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="card">
              <p style={{ color: "#e5484d", fontSize: 14, margin: 0 }}>{errorMsg}</p>
            </div>
          )}

          {status === "done" && result && (
            <div className="card result">
              <p className="title">{result.title}</p>
              <p>{result.summary}</p>
              {result.key_points?.length > 0 && (
                <ul>
                  {result.key_points.map((kp, i) => (
                    <li key={i}>{kp}</li>
                  ))}
                </ul>
              )}
              <div className="chips">
                <span className="chip">📁 {result.suggested_bucket}</span>
                <span className="chip">🧠 {result.cognitive_mode}</span>
                <span className="chip">⚡ {result.actionability_score}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }
        :global(body) {
          margin: 0;
          min-height: 100vh;
          font-family: "Inter", system-ui, sans-serif;
          background: #ececed !important;
          color: #1c1c20 !important;
        }
        .topbar {
          position: sticky;
          top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 8px 8px 18px;
          border-radius: 999px;
          margin: 16px auto 0;
          width: min(900px, 90vw);
          background: #fff;
          border: 1px solid #dcdce1;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          z-index: 10;
        }
        .logo {
          width: 30px;
          height: 30px;
          object-fit: contain;
        }
        .navbtns {
          display: flex;
          align-items: center;
          gap: 18px;
          font-size: 14px;
        }
        .navbtns a {
          cursor: pointer;
          color: #7a7a82;
        }
        .navbtns a.active {
          color: #1c1c20;
          font-weight: 600;
        }
        .btn {
          border-radius: 999px;
          padding: 9px 18px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .hamb {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid #dcdce1;
          color: #26262b;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
        }
        .float-mark {
          position: absolute;
          object-fit: contain;
          pointer-events: none;
          opacity: 0;
        }
        @keyframes popLeft {
          0% {
            transform: translateX(-140px) scale(0.5) rotate(-15deg);
            opacity: 0;
          }
          70% {
            transform: translateX(8px) scale(1.05) rotate(-8deg);
          }
          100% {
            transform: translateX(0) scale(1) rotate(-8deg);
            opacity: var(--end-op, 0.16);
          }
        }
        @keyframes popRight {
          0% {
            transform: translateX(140px) scale(0.5) rotate(15deg);
            opacity: 0;
          }
          70% {
            transform: translateX(-8px) scale(1.05) rotate(8deg);
          }
          100% {
            transform: translateX(0) scale(1) rotate(8deg);
            opacity: var(--end-op, 0.16);
          }
        }
        .fm-l1 {
          top: 20%;
          left: 6%;
          width: 180px;
          filter: blur(1px);
          animation: popLeft 0.9s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.1s forwards;
        }
        .fm-l2 {
          top: 70%;
          left: 3%;
          width: 110px;
          animation: popLeft 1s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.35s forwards;
        }
        .fm-r1 {
          top: 24%;
          right: 6%;
          width: 150px;
          filter: blur(1px);
          animation: popRight 0.9s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.2s forwards;
        }
        .fm-r2 {
          top: 74%;
          right: 4%;
          width: 95px;
          animation: popRight 1s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.45s forwards;
        }
        .page-bg {
          position: relative;
          overflow: hidden;
          min-height: calc(100vh - 90px);
        }
        .wrap {
          max-width: 640px;
          margin: 0 auto;
          padding: 56px 24px 80px;
          position: relative;
        }
        .h1 {
          font-size: 26px;
          font-weight: 600;
          letter-spacing: -0.01em;
          margin: 0 0 8px;
        }
        .sub {
          font-size: 14px;
          color: #7a7a82;
          margin: 0 0 28px;
        }
        .card {
          background: #ffffff;
          border: 1px solid #dcdce1;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 12px 32px rgba(20, 20, 25, 0.06);
          margin-bottom: 16px;
        }
        textarea {
          width: 100%;
          border: none;
          outline: none;
          resize: none;
          font-size: 15px;
          font-family: inherit;
          color: #1c1c20;
          background: transparent;
        }
        textarea::placeholder {
          color: #a8a8ae;
        }
        .card-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #ececed;
        }
        .voice {
          font-size: 13px;
          color: #7a7a82;
          display: flex;
          gap: 6px;
          align-items: center;
          cursor: pointer;
        }
        .capture-btn {
          background: #2f6fed;
          color: #fff;
          padding: 10px 20px;
          font-size: 14px;
        }
        .capture-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .result p {
          margin: 0 0 10px;
          font-size: 14px;
          line-height: 1.6;
          color: #4b4b52;
        }
        .result p.title {
          font-weight: 600;
          color: #1c1c20;
          font-size: 15px;
        }
        .result ul {
          margin: 0 0 14px;
          padding-left: 18px;
          font-size: 14px;
          color: #5b5b63;
          line-height: 1.7;
        }
        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          font-family: "JetBrains Mono", monospace;
          font-size: 12px;
          background: #eef3fe;
          color: #2f6fed;
          border-radius: 999px;
          padding: 4px 10px;
        }
      `}</style>
    </>
  );
}
