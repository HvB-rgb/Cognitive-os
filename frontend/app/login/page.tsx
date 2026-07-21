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
      // Server Components (dashboard/review/graph) can't read localStorage —
      // this httpOnly cookie is what lets them resolve who's actually asking.
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_token: data.dashboard_token }),
      });
      router.push("/capture");
    } catch {
      setError("Couldn't reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <img className="logo" src="/logo.png" alt="" />
        <span className="wordmark">Cognitive OS</span>
        <div className="navbtns">
          <button className="btn" style={{ background: "#1c1c20", color: "#fff" }}>
            Log In
          </button>
          <button
            className="btn"
            style={{ background: "#faf8f2", border: "1px solid #e2dbc7", color: "#1c1c20" }}
            onClick={() => router.push("/signup")}
          >
            Get started
          </button>
        </div>
      </div>

      <div className="wrap">
        <img className="float-mark fm-l1" src="/logo.png" alt="" style={{ "--end-op": 0.14 } as React.CSSProperties} />
        <img className="float-mark fm-l2" src="/logo.png" alt="" style={{ "--end-op": 0.22 } as React.CSSProperties} />
        <img className="float-mark fm-r1" src="/logo.png" alt="" style={{ "--end-op": 0.14 } as React.CSSProperties} />
        <img className="float-mark fm-r2" src="/logo.png" alt="" style={{ "--end-op": 0.2 } as React.CSSProperties} />
        <div className="card-frame">
          <div className="halo-wrap">
            <div className="band b1" />
            <div className="band b2" />
            <div className="band b3" />
            <div className="band b4" />
            <div className="band b5" />
            <div className="band b6" />
          </div>
          <div className="card">
            <img className="mark" src="/logo.png" alt="" />
            <h1>Sign in</h1>
            <p className="sub">Enter your unique ID nothing else...</p>
            <form onSubmit={handleSubmit}>
              <label>
                Your ID
                <input
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="HVB_2108"
                />
              </label>

              {error && (
                <p style={{ color: "#c0392b", fontSize: 13, margin: "0 0 14px", textAlign: "left" }}>{error}</p>
              )}

              <button className="btn card-cta" type="submit" disabled={loading || !username.trim()}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <p className="foot">
              No account? <a onClick={() => router.push("/signup")}>Create one</a>
            </p>
          </div>
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
          background: #f5f1e8 !important;
          color: #1c1c20 !important;
        }
        .topbar {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 16px 32px;
          border-bottom: 1px solid #e2dbc7;
          background: #faf8f2;
        }
        .logo {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }
        .wordmark {
          font-family: "JetBrains Mono", monospace;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          margin-right: auto;
          padding-left: 8px;
        }
        .navbtns {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: "JetBrains Mono", monospace;
          font-size: 14px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .btn {
          border-radius: 6px;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .hamb {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid #e2dbc7;
          color: #1c1c20;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
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
          top: 14%;
          left: 6%;
          width: 180px;
          filter: blur(1px);
          animation: popLeft 0.9s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.1s forwards;
        }
        .fm-l2 {
          top: 62%;
          left: 3%;
          width: 110px;
          animation: popLeft 1s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.35s forwards;
        }
        .fm-r1 {
          top: 20%;
          right: 6%;
          width: 150px;
          filter: blur(1px);
          animation: popRight 0.9s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.2s forwards;
        }
        .fm-r2 {
          top: 66%;
          right: 4%;
          width: 95px;
          animation: popRight 1s cubic-bezier(0.2, 0.8, 0.3, 1.2) 0.45s forwards;
        }
        .wrap {
          min-height: calc(100vh - 64px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          position: relative;
          overflow: hidden;
        }
        .card-frame {
          position: relative;
          display: inline-block;
        }
        .halo-wrap {
          position: absolute;
          top: -56px;
          left: -56px;
          right: -56px;
          bottom: -56px;
          z-index: 0;
          pointer-events: none;
        }
        .band {
          position: absolute;
        }
        .b1 {
          inset: 0;
          border-radius: 66px;
          background: #f3ceb0;
        }
        .b2 {
          inset: 11px;
          border-radius: 55px;
          background: #f6dcc4;
        }
        .b3 {
          inset: 22px;
          border-radius: 44px;
          background: #f8e6d6;
        }
        .b4 {
          inset: 33px;
          border-radius: 33px;
          background: #faeee3;
        }
        .b5 {
          inset: 44px;
          border-radius: 22px;
          background: #fcf4ec;
        }
        .b6 {
          inset: 53px;
          border-radius: 13px;
          background: #faf8f2;
        }
        .card {
          position: relative;
          z-index: 1;
          width: 380px;
          background: #faf8f2;
          border: 1px solid #e2dbc7;
          border-radius: 10px;
          padding: 36px 36px 32px;
          text-align: center;
          box-shadow: 0 12px 32px rgba(20, 20, 25, 0.06);
        }
        .mark {
          width: 45px;
          height: 39px;
          object-fit: contain;
          margin: 0 auto 20px;
          filter: brightness(1.1) saturate(1.4);
        }
        .card h1 {
          font-family: "Newsreader", serif;
          font-weight: 500;
          font-size: 26px;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }
        .card .sub {
          font-size: 14px;
          color: #7a7568;
          margin: 0 0 24px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-family: "JetBrains Mono", monospace;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #8a8474;
          margin-bottom: 18px;
          text-align: left;
        }
        input {
          width: 100%;
          background: #f5f1e8;
          border: 1px solid #e2dbc7;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 14px;
          font-family: "JetBrains Mono", monospace;
          letter-spacing: 0.02em;
          color: #1c1c20;
          outline: none;
        }
        input:focus {
          border-color: #2f6fed;
        }
        .card-cta {
          width: 100%;
          background: #2f6fed;
          color: #fff;
          padding: 12px;
          font-size: 14px;
          border-radius: 8px;
          margin-top: 4px;
          text-transform: none;
          letter-spacing: normal;
          font-family: "Inter", sans-serif;
        }
        .card-cta:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .foot {
          text-align: center;
          font-size: 12px;
          color: #7a7568;
          margin-top: 16px;
        }
        .foot a {
          color: #2f6fed;
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
