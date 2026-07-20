"use client";

import { useEffect, useState } from "react";

/** The dashboard route is a server component (direct-to-Supabase, service
 * key) with no concept of "who's logged in" — that only exists client-side
 * in localStorage (set by /login and /signup). This is the one piece of
 * the page that needs to run in the browser to say a real name instead of
 * a hardcoded one. */
export default function Greeting() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(localStorage.getItem("first_name"));
  }, []);

  if (!name) return null;
  return <>Hello, {name}. </>;
}
