"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HamburgerLogout from "@/components/HamburgerLogout";
import styles from "./connect.module.css";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const ENDPOINT = `${BACKEND_URL}/api/process/text`;

export default function ConnectPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("dashboard_token");
    if (!localStorage.getItem("user_id") || !t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  async function copy(value: string, which: "token" | "url") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
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
          Cognitive OS from the Share menu — without leaving the app you&apos;re in.
        </p>

        <div className={styles.card}>
          <p className={styles.lbl}>Your personal key</p>
          <div className={styles.tokenRow}>
            <div className={styles.token}>{token}</div>
            <button
              className={`${styles.copyBtn} ${copied === "token" ? styles.copied : ""}`}
              onClick={() => copy(token, "token")}
            >
              {copied === "token" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className={styles.note}>
            Keep this private — it&apos;s what tells Cognitive OS the saved item is yours. Anyone with
            it can save into your account.
          </p>
        </div>

        <div className={styles.card}>
          <p className={styles.lbl}>Build the shortcut (once)</p>
          <ol className={styles.steps}>
            <li>
              Open the <b>Shortcuts</b> app on your iPhone → tap <span className={styles.kv}>+</span> to
              create a new shortcut.
            </li>
            <li>
              Add the action <span className={styles.kv}>Get Contents of URL</span>, then tap
              &quot;Show More&quot; and set it up like this:
              <div className={styles.field}>
                <b>URL:</b> {ENDPOINT}
                <br />
                <b>Method:</b> POST
                <br />
                <b>Headers:</b>
                <br />
                &nbsp;&nbsp;Content-Type = application/json
                <br />
                &nbsp;&nbsp;X-Dashboard-Token = <span style={{ color: "#2f6fed" }}>(paste your key)</span>
                <br />
                <b>Request Body:</b> JSON
                <br />
                &nbsp;&nbsp;payload_type (Text) = url
                <br />
                &nbsp;&nbsp;raw_content (Text) = <b>Shortcut Input</b>
              </div>
            </li>
            <li>
              (Optional) Add <span className={styles.kv}>Show Notification</span> → &quot;Saved to
              Cognitive OS ✓&quot; so you get a confirmation.
            </li>
            <li>
              Open the shortcut&apos;s settings (ⓘ) → turn on <b>Show in Share Sheet</b>, and allow
              types <b>URLs</b> and <b>Text</b>. Name it <b>Save to Cognitive OS</b>.
            </li>
          </ol>
        </div>

        <div className={styles.card}>
          <p className={styles.lbl}>Then, from anywhere</p>
          <p className={styles.usage}>
            In Instagram, open a reel → tap <b>Share</b> (the paper-airplane) → <b>Share to…</b> →{" "}
            <b>Save to Cognitive OS</b>. That&apos;s it — it lands in your buckets and you stay in
            Instagram. Works the same from Safari, YouTube, or any app&apos;s Share button.
          </p>
        </div>
      </div>
    </div>
  );
}
