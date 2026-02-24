"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function EmailSignup({ source = "homepage" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase(), source });

    if (error) {
      if (error.code === "23505") {
        setState("success");
        setMessage("You're already on the list!");
      } else {
        setState("error");
        setMessage("Something went wrong. Try again.");
      }
    } else {
      setState("success");
      setMessage("You're on the list!");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
      {state === "success" ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : (
        <>
          <div className="flex gap-2 w-full max-w-sm">
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="rounded bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {state === "loading" ? "..." : "Notify me"}
            </button>
          </div>
          {state === "error" && (
            <p className="text-sm text-red-500">{message}</p>
          )}
        </>
      )}
    </form>
  );
}
