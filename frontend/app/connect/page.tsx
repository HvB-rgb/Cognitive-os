"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./connect.module.css";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const ENDPOINT = `${BACKEND_URL}/api/process/text`;
const SHORTCUT_URL = "https://www.icloud.com/shortcuts/4c3c504a33be44b291c127e4e3428e2f";

export default function ConnectPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("dashboard_token");
    if (!localStorage.getItem("user_id") || !t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  if (!token) return null;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <img className={styles.logo} src="/logo.png" alt="" />
        <span className={styles.word}>Cognitive OS</span>
        <div className={styles.navbtns}>
          <a href="/capture">Capture</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/graph">Graph</a>
          <a href="/review">Review</a>
          <HamburgerLogout className={styles.hamb} />
        </div>
      </div>

      <div className={styles.wrap}>
        <a className={styles.back} href="/dashboard">
          ← Dashboard
        </a>
        <h1 className={styles.h1}>Save from your iPhone</h1>
        <p className={styles.sub}>
          Set this up once, then send reels, links, or anything you&apos;re looking at straight to
          Cognitive OS from the Share menu — without leaving the app you&apos;re in. Open this page on
          your iPhone to add it.
        </p>

        {/* ── Primary path: the ready-made shortcut ── */}
        <div className={styles.card}>
          <p className={styles.lbl}>Set up in 3 steps</p>
          <ol className={styles.steps}>
            <li>
              <a className={styles.shortcutBtn} href={SHORTCUT_URL} target="_blank" rel="noopener noreferrer">
                Get the shortcut
              </a>
              <span className={styles.stepNote}>
                Opens in the Shortcuts app → tap <b>Add Shortcut</b>.
              </span>
            </li>
            <li>
              Copy your personal key:
              <div className={styles.tokenRow}>
                <div className={styles.token}>{token}</div>
                <button
                  className={`${styles.copyBtn} ${copied ? styles.copied : ""}`}
                  onClick={() => copy(token)}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </li>
            <li>
              Open the shortcut → the <span className={styles.kv}>Get Contents of URL</span> action →{" "}
              <b>Headers</b> → tap the <span className={styles.kv}>X-Dashboard-Token</span> value
              (it says <span className={styles.kv}>PASTE_YOUR_KEY</span>) and paste your key over it.
              That&apos;s it.
            </li>
          </ol>
          <p className={styles.note}>
            Keep your key private — it&apos;s what tells Cognitive OS the saved item is yours. Anyone
            with it can save into your account.
          </p>
        </div>

        {/* ── How to use it ── */}
        <div className={styles.card}>
          <p className={styles.lbl}>Then, from anywhere</p>
          <p className={styles.usage}>
            In Instagram, open a reel → tap <b>Share</b> (the paper-airplane) → <b>Share to…</b> →{" "}
            <b>Save It To Cognitive OS</b>. It lands in your buckets and you stay in Instagram. Works
            the same from Safari, YouTube, or any app&apos;s Share button.
          </p>
        </div>

        {/* ── Fallback: build it by hand ── */}
        <details className={styles.details}>
          <summary className={styles.summary}>Prefer to build it by hand?</summary>
          <div className={styles.field}>
            <b>Get Contents of URL</b>
            <br />
            <b>URL:</b> {ENDPOINT}
            <br />
            <b>Method:</b> POST
            <br />
            <b>Headers:</b>
            <br />
            &nbsp;&nbsp;Content-Type = application/json
            <br />
            &nbsp;&nbsp;X-Dashboard-Token = <span style={{ color: "#2f6fed" }}>(your key)</span>
            <br />
            <b>Request Body:</b> JSON
            <br />
            &nbsp;&nbsp;payload_type (Text) = url
            <br />
            &nbsp;&nbsp;raw_content (Text) = <b>Shortcut Input</b>
            <br />
            <br />
            Then in the shortcut settings, turn on <b>Show in Share Sheet</b> (accept URLs and Text).
          </div>
        </details>
      </div>
    </div>
  );
}
