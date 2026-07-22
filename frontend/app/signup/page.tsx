"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dob: string;
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    dob: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  function update(field: keyof Form, value: string) {
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
      // Server Components (dashboard/review/graph) can't read localStorage —
      // this httpOnly cookie is what lets them resolve who's actually asking.
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_token: data.dashboard_token }),
      });
      setUsername(data.username);
    } catch {
      setError("Couldn't reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  // Scroll-driven logo docking animation — verbatim from the design, adapted
  // to run as a client-side effect instead of a page <script> tag.
  useEffect(() => {
    const heroLogo = document.getElementById("heroLogo") as HTMLImageElement | null;
    const dockedLogo = document.getElementById("dockedLogo") as HTMLImageElement | null;
    const heroGlow = document.getElementById("heroGlow");
    const badge = document.getElementById("powerBadge");
    const dockSlot = document.getElementById("dockSlot");
    const quoteBlock = document.querySelector(".quote-block");
    if (!heroLogo || !dockedLogo || !heroGlow || !badge || !dockSlot || !quoteBlock) return;

    let docked = false;
    let quoteBlockDocTop = 0;

    function measure() {
      quoteBlockDocTop = quoteBlock!.getBoundingClientRect().top + window.scrollY;
    }
    measure();

    function ease(t: number) {
      if (t < 0.5) return t;
      const u = (t - 0.5) * 2;
      return 0.5 + u * u * 0.5;
    }

    // Docking is a crossfade between two separate <img> elements (one fixed,
    // one permanently inside dockSlot) rather than moving a single DOM node
    // between parents. Re-parenting a React-rendered node outside its own
    // subtree (as the original design's script did via appendChild) leaves
    // React's fiber tree out of sync with the real DOM — the next unmount
    // (e.g. navigating away) throws trying to remove a child that's no
    // longer where React expects it.
    function dock() {
      docked = true;
      heroLogo!.style.opacity = "0";
      dockedLogo!.style.opacity = "1";
      (heroGlow as HTMLElement).style.opacity = "0";
    }

    function undock() {
      docked = false;
      dockedLogo!.style.opacity = "0";
      (heroGlow as HTMLElement).style.opacity = "1";
    }

    function onScroll() {
      const max = document.body.scrollHeight - window.innerHeight;
      const p = Math.max(0, Math.min(1, window.scrollY / max));
      const travelStart = quoteBlockDocTop - window.innerHeight * 1.1;
      const travelEnd = quoteBlockDocTop - window.innerHeight * 0.35;
      const t2 = Math.max(0, Math.min(1, (window.scrollY - travelStart) / (travelEnd - travelStart)));

      if (t2 >= 1 && !docked) dock();
      if (t2 < 1 && docked) undock();

      if (!docked) {
        const rect = dockSlot!.getBoundingClientRect();
        const e = ease(t2);
        const curLeft = 106 + (rect.left - 106) * e;
        const curTop = 484 + (rect.top - 484) * e;
        heroLogo!.style.left = curLeft + "px";
        heroLogo!.style.top = curTop + "px";
        const idleScale = 0.75 + p * 0.25;
        heroLogo!.style.transform = `scale(${idleScale + (1 - idleScale) * e})`;
        heroLogo!.style.filter = `brightness(${0.55 + p * 0.85 + e * 0.4}) saturate(${0.4 + p * 1.6 + e * 0.6})`;
        heroLogo!.style.opacity = String((0.55 + p * 0.45) * (1 - e) + e);
        (heroGlow as HTMLElement).style.left = curLeft - (26 - 22.5) + "px";
        (heroGlow as HTMLElement).style.top = curTop - (26 - 19.5) + "px";
        (heroGlow as HTMLElement).style.transform = `scale(${(1 + p * 1.1) * (1 - e)})`;
        (heroGlow as HTMLElement).style.background = `radial-gradient(circle, rgba(47,111,237,${p * 0.6 * (1 - e)}) 0%, rgba(47,111,237,${p * 0.12 * (1 - e)}) 40%, rgba(47,111,237,0) 60%)`;
        (heroGlow as HTMLElement).style.opacity = String(1 - e);
      }
      (badge as HTMLElement).style.boxShadow = `0 0 ${p * 46}px ${p * 10}px rgba(47,111,237,${p * 0.9})`;
      (badge as HTMLElement).style.transform = `scale(${1 + p * 0.35}) rotate(${p * 20}deg)`;
      const badgeImg = badge!.querySelector("img") as HTMLElement | null;
      if (badgeImg) badgeImg.style.filter = `brightness(${1 + p * 0.5}) saturate(${1 + p * 0.6})`;
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll);
    onScroll();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll(".copy,.feature,.quote-inner").forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <>
      <div className="topbar">
        <img className="logo" src="/logo.png" alt="" />
        <span className="wordmark">Cognitive OS</span>
        <div className="navbtns">
          <button className="btn" style={{ background: "#faf8f2", border: "1px solid #e2dbc7", color: "#1c1c20" }} onClick={() => router.push("/login")}>
            Log In
          </button>
          <button
            className="btn"
            style={{ background: "#1c1c20", color: "#fff" }}
            onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
          >
            Get started
          </button>
        </div>
      </div>

      <div className="hero">
        <h1 className="h1">
          A second brain that thinks
          <br />
          for you a little, so you can
          <br />
          <span>think better yourself.</span>
        </h1>
        <p className="hero-sub">
          Send it whatever crosses your mind or your feed - a link, a video, a reel, a voice note, a
          stray 2am thought - and it reads it, watches it, listens to it, and quietly files away what
          actually mattered.
        </p>
        <div className="cta-row">
          <button
            className="btn cta-primary"
            onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
          >
            Get started
          </button>
          <button
            className="btn cta-ghost"
            onClick={() => document.getElementById("what-it-is")?.scrollIntoView({ behavior: "smooth" })}
          >
            See how it works
          </button>
        </div>
      </div>

      <section className="copy" id="what-it-is">
        <p className="eyebrow">What it is</p>
        <h2>No folders. No tags. No &quot;I&apos;ll organize this later.&quot;</h2>
        <p>
          Cognitive OS is a second brain that thinks for you a little, so you can think better
          yourself. You send it whatever crosses your mind or your feed - a link, a video, an
          Instagram reel, a voice note, a stray 2am thought - and it reads it, watches it, listens to
          it, and quietly files away what actually mattered.
        </p>
      </section>

      <section className="copy">
        <p className="eyebrow">The problem it solves</p>
        <h2>Most of what you consume in a day disappears</h2>
        <p>
          You save an article and never open it again. You watch a reel that genuinely changes how
          you think about something, and by the next morning you couldn&apos;t repeat the idea if
          asked. You have a voice memo from three weeks ago you&apos;re pretty sure was important.
          Modern life produces more insight per day than any person can retain.
        </p>
        <p className="pullquote">The bottleneck was never finding good ideas - it&apos;s keeping them.</p>
        <p>
          Note apps don&apos;t fix this because they demand exactly the discipline you don&apos;t have
          time for: naming things, filing things, reviewing things. The friction of &quot;doing it
          properly&quot; is why the note never gets taken at all.
        </p>
      </section>

      <div className="features">
        <p className="eyebrow" style={{ paddingLeft: 0 }}>
          What it actually does for you
        </p>
        <div className="feature">
          <span className="fnum">01</span>
          <div className="fbody">
            <b>Catches everything, effortlessly.</b>
            <span>
              A link, a thought, a voice note, a video - you just send it, in whatever form it
              naturally arrives in. No formatting, no categorizing.
            </span>
          </div>
        </div>
        <div className="feature">
          <span className="fnum">02</span>
          <div className="fbody">
            <b>Understands it for you.</b>
            <span>
              It reads the article, watches the reel, transcribes the voice note - and pulls out the
              actual idea, not just the raw content.
            </span>
          </div>
        </div>
        <div className="feature">
          <span className="fnum">03</span>
          <div className="fbody">
            <b>Organizes itself.</b>
            <span>
              Everything lands in the right place automatically, based on what it&apos;s actually
              about - not what folder you remembered to click.
            </span>
          </div>
        </div>
        <div className="feature">
          <span className="fnum">04</span>
          <div className="fbody">
            <b>Remembers before you forget.</b>
            <span>
              It resurfaces what you saved right at the point your brain would naturally start to
              lose it - the same principle behind how memory actually sticks.
            </span>
          </div>
        </div>
        <div className="feature">
          <span className="fnum">05</span>
          <div className="fbody">
            <b>Shows you your own mind.</b>
            <span>
              Over time, it notices things you didn&apos;t consciously plan - that two unrelated
              interests keep circling the same idea, or that a whole week was unusually focused or
              scattered.
            </span>
          </div>
        </div>
      </div>

      <section className="copy">
        <p className="eyebrow">Who it&apos;s for</p>
        <h2>Anyone whose curiosity outpaces their filing system</h2>
        <p>
          Which is most curious people. It&apos;s for the person with forty saved links, a voice
          memos app they&apos;re afraid to open, and a real, honest sense that they&apos;re learning
          constantly but retaining very little of it.
        </p>
      </section>

      <div className="quote-block">
        <div className="quote-inner">
          <div className="dock-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
            <span id="dockSlot" style={{ width: 45, height: 39, display: "inline-block", flexShrink: 0, position: "relative" }}>
              <img
                id="dockedLogo"
                src="/logo.png"
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  opacity: 0,
                  filter: "brightness(1.3) saturate(1.6)",
                  transition: "opacity .15s ease-out",
                }}
              />
            </span>
            <p className="eyebrow" style={{ margin: 0 }}>
              The core idea, in one line
            </p>
          </div>
          <p>
            You shouldn&apos;t have to work to remember your own best thinking. Cognitive OS is the
            difference between information passing through you and actually becoming part of how you
            think.
          </p>
        </div>
      </div>

      <div className="signup-wrap" id="signup">
        <div className="card">
          {username ? (
            <>
              <h1>Welcome, {form.firstName}.</h1>
              <p className="sub">
                Your unique ID is <span style={{ color: "#2f6fed", fontFamily: "monospace" }}>{username}</span>
              </p>
              <button className="btn card-cta" onClick={() => router.push("/capture")}>
                Start capturing
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1>Create your account</h1>
              <p className="sub">Your personal knowledge layer</p>
              <div className="row2">
                <label>
                  First name
                  <input
                    required
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    placeholder="Harsh Vardhan"
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    placeholder="Bagri"
                  />
                </label>
              </div>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <label>
                Date of birth
                <input
                  required
                  type="date"
                  value={form.dob}
                  onChange={(e) => update("dob", e.target.value)}
                />
              </label>

              {error && (
                <p style={{ color: "#c0392b", fontSize: 13, margin: "0 0 14px" }}>{error}</p>
              )}

              <button className="btn card-cta" type="submit" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </button>
              <p className="foot">
                Already have an ID?{" "}
                <a onClick={() => router.push("/login")}>Sign in</a>
              </p>
            </form>
          )}
        </div>
      </div>

      <div
        id="heroGlow"
        style={{
          position: "fixed",
          left: 104.5,
          top: 479.5,
          width: 48,
          height: 48,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 5,
          transform: "scale(1)",
          transition: "transform .15s ease-out,background .15s ease-out,opacity .2s ease-out",
        }}
      />
      <img
        className="hero-logo"
        id="heroLogo"
        src="/logo.png"
        alt=""
        style={{
          position: "fixed",
          left: 106,
          top: 484,
          zIndex: 6,
          transformOrigin: "center center",
          transition: "filter .15s ease-out,opacity .2s ease-out,transform .15s ease-out",
        }}
      />
      <div className="power-badge" id="powerBadge">
        <img src="/logo.png" alt="" />
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }
        :global(html) {
          scroll-behavior: smooth;
        }
        /* !important needed: layout.tsx sets bg-surface/text-white via a
           Tailwind class on <body>, which outranks a plain element selector */
        :global(body) {
          margin: 0;
          font-family: "Inter", system-ui, sans-serif;
          background: #f5f1e8 !important;
          color: #1c1c20 !important;
        }
        .topbar {
          position: sticky;
          top: 0;
          z-index: 50;
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
        .hero {
          max-width: 720px;
          margin: 0 auto;
          padding: 100px 24px 60px;
          text-align: center;
        }
        :global(.hero-logo) {
          width: 45px;
          height: 39px;
          object-fit: contain;
          margin: 0 auto 32px;
          filter: brightness(0.55) saturate(0.4);
          opacity: 0.55;
          transition: filter 0.15s ease-out, opacity 0.15s ease-out, transform 0.15s ease-out;
        }
        .h1 {
          font-family: "Newsreader", serif;
          font-weight: 500;
          font-size: 44px;
          line-height: 1.15;
          letter-spacing: -0.01em;
          margin: 0 0 18px;
        }
        .h1 span {
          color: #2f6fed;
        }
        .hero-sub {
          font-size: 17px;
          color: #5b564a;
          line-height: 1.6;
          max-width: 560px;
          margin: 0 auto 32px;
        }
        .cta-row {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .cta-primary {
          background: #2f6fed;
          color: #fff;
          padding: 13px 26px;
          font-size: 15px;
          border-radius: 8px;
        }
        .cta-ghost {
          background: #faf8f2;
          color: #1c1c20;
          border: 1px solid #e2dbc7;
          padding: 13px 26px;
          font-size: 15px;
          border-radius: 8px;
        }
        :global(section.copy) {
          max-width: 640px;
          margin: 0 auto;
          padding: 64px 24px;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        :global(section.copy.visible) {
          opacity: 1;
          transform: translateY(0);
        }
        .eyebrow {
          font-family: "JetBrains Mono", monospace;
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #8a8474;
          margin: 0 0 10px;
        }
        :global(.copy h2) {
          font-family: "Newsreader", serif;
          font-weight: 500;
          font-size: 28px;
          letter-spacing: -0.01em;
          margin: 0 0 18px;
        }
        :global(.copy p) {
          font-size: 16px;
          line-height: 1.7;
          color: #4b4b52;
          margin: 0 0 16px;
        }
        :global(.pullquote) {
          font-family: "Newsreader", serif;
          font-size: 21px;
          font-weight: 500;
          line-height: 1.5;
          color: #1c1c20;
          border-left: 3px solid #2f6fed;
          padding-left: 20px;
          margin: 24px 0;
        }
        .features {
          max-width: 800px;
          margin: 0 auto;
          padding: 64px 24px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        :global(.feature) {
          display: flex;
          gap: 20px;
          padding: 22px 0;
          border-top: 1px dashed #cfc6ab;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        :global(.feature.visible) {
          opacity: 1;
          transform: translateY(0);
        }
        :global(.feature:last-child) {
          border-bottom: 1px dashed #cfc6ab;
        }
        .fnum {
          font-family: "JetBrains Mono", monospace;
          font-size: 13px;
          color: #2f6fed;
          flex-shrink: 0;
          width: 28px;
          padding-top: 2px;
        }
        .fbody b {
          display: block;
          font-size: 16px;
          margin-bottom: 4px;
        }
        .fbody span {
          font-size: 14px;
          color: #5b564a;
          line-height: 1.6;
        }
        .quote-block {
          background: #1c1c20;
          color: #f2f2f3;
          padding: 100px 24px;
          text-align: center;
        }
        :global(.quote-inner) {
          max-width: 640px;
          margin: 0 auto;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        :global(.quote-inner.visible) {
          opacity: 1;
          transform: translateY(0);
        }
        .quote-inner :global(.eyebrow) {
          color: #9a9aa4;
        }
        .quote-inner p {
          font-family: "Newsreader", serif;
          font-size: 27px;
          line-height: 1.5;
          font-weight: 500;
          letter-spacing: -0.005em;
          margin: 0;
        }
        .signup-wrap {
          padding: 80px 24px 100px;
          display: flex;
          justify-content: center;
        }
        .card {
          width: 400px;
          background: #faf8f2;
          border: 1px solid #e2dbc7;
          border-radius: 10px;
          padding: 36px 36px 32px;
          box-shadow: 0 12px 32px rgba(20, 20, 25, 0.06);
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
        .row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 14px;
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
          margin-bottom: 14px;
        }
        input {
          width: 100%;
          background: #f5f1e8;
          border: 1px solid #e2dbc7;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 14px;
          color: #1c1c20;
          outline: none;
          font-family: "Inter", sans-serif;
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
          margin-top: 6px;
          text-transform: none;
          letter-spacing: normal;
          font-family: "Inter", sans-serif;
          font-weight: 600;
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
        .power-badge {
          position: fixed;
          right: 28px;
          bottom: 28px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #faf8f2;
          border: 1px solid #e2dbc7;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 60;
          transition: transform 0.1s linear;
        }
        .power-badge img {
          width: 60%;
          height: 60%;
          object-fit: contain;
          transition: filter 0.1s linear;
        }
        @media (max-width: 640px) {
          .topbar {
            flex-wrap: wrap;
            padding: 12px 16px;
            gap: 10px;
          }
          .hero {
            padding: 56px 20px 40px;
          }
          .h1 {
            font-size: 30px;
          }
          .hero-sub {
            font-size: 15px;
          }
          :global(section.copy) {
            padding: 40px 20px;
          }
          :global(.copy h2) {
            font-size: 24px;
          }
          .features {
            padding: 40px 20px;
          }
          .quote-block {
            padding: 60px 20px;
          }
          .quote-inner p {
            font-size: 21px;
          }
          .card {
            width: 100%;
            max-width: 400px;
            padding: 28px 24px;
          }
          .power-badge {
            right: 16px;
            bottom: 16px;
            width: 48px;
            height: 48px;
          }
        }
      `}</style>
    </>
  );
}
