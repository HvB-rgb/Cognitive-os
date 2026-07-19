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
    <>
      <div className="topbar">
        <img className="logo" src="/logo.png" alt="Cognitive OS" />
        <div className="navbtns">
          <button className="btn" style={{ background: "#26262b", color: "#fff" }}>
            Log In
          </button>
          <button
            className="btn"
            style={{ background: "#fff", border: "1px solid #dcdce1", color: "#26262b" }}
            onClick={() => router.push("/signup")}
          >
            Get started
          </button>
          <span className="hamb">☰</span>
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
            <p className="sub">Enter your unique ID nothing else....</p>
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
                <p style={{ color: "#e5484d", fontSize: 13, margin: "0 0 14px", textAlign: "left" }}>{error}</p>
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
        }
        .logo {
          width: 30px;
          height: 30px;
          object-fit: contain;
        }
        .navbtns {
          display: flex;
          align-items: center;
          gap: 10px;
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
          min-height: calc(100vh - 90px);
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
          border-radius: 72px;
          background: #3a5fc4;
        }
        .b2 {
          inset: 11px;
          border-radius: 61px;
          background: #2f5fd6;
        }
        .b3 {
          inset: 22px;
          border-radius: 50px;
          background: #4a7ff0;
        }
        .b4 {
          inset: 33px;
          border-radius: 39px;
          background: #7fa8f7;
        }
        .b5 {
          inset: 44px;
          border-radius: 28px;
          background: #bcd4fb;
        }
        .b6 {
          inset: 53px;
          border-radius: 19px;
          background: #f7f3ec;
        }
        .card {
          position: relative;
          z-index: 1;
          width: 380px;
          background: #ffffff;
          border: 1px solid #dcdce1;
          border-radius: 16px;
          padding: 36px 36px 32px;
          text-align: center;
          box-shadow: 0 12px 32px rgba(20, 20, 25, 0.08);
        }
        .mark {
          width: 45px;
          height: 39px;
          object-fit: contain;
          margin: 0 auto 20px;
          filter: brightness(1.1) saturate(1.4);
        }
        .card h1 {
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }
        .card .sub {
          font-size: 14px;
          color: #7a7a82;
          margin: 0 0 24px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: #7a7a82;
          margin-bottom: 18px;
          text-align: left;
        }
        input {
          width: 100%;
          background: #f4f4f6;
          border: 1px solid #dcdce1;
          border-radius: 8px;
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
          margin-top: 4px;
        }
        .card-cta:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .foot {
          text-align: center;
          font-size: 12px;
          color: #7a7a82;
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
