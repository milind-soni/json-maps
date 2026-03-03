"use client";

export function EmailSignup({ source }: { source?: string }) {
  return (
    <form
      className="flex gap-2 max-w-sm mx-auto"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const email = new FormData(form).get("email") as string;
        if (email) {
          console.log(`[EmailSignup] ${source}: ${email}`);
          form.reset();
        }
      }}
    >
      <input
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Notify me
      </button>
    </form>
  );
}
