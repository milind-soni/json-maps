import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Storytelling Maps — Coming Soon",
};

export default function StorytellingPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-32 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 px-4 py-1.5 mb-8">
        <span className="text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
          Coming Soon
        </span>
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter mb-6">
        Storytelling Maps
      </h1>

      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
        Animated map videos and interactive story-driven maps.
        Turn your map specs into cinematic fly-throughs, data narratives,
        and shareable visual stories.
      </p>

      <div className="grid sm:grid-cols-2 gap-8 text-left max-w-2xl mx-auto mb-16">
        <div className="rounded-lg border border-border p-6">
          <div className="text-2xl mb-3">🎬</div>
          <h3 className="font-semibold mb-2">Animated Map Videos</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Generate cinematic map animations with Remotion.
            Fly between locations, animate data layers over time,
            and export as MP4 for presentations and social media.
          </p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <div className="text-2xl mb-3">📖</div>
          <h3 className="font-semibold mb-2">Interactive Stories</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Build scroll-driven map narratives with json-ui.
            Chain map states together with text, images, and data
            to create guided explorations of geographic data.
          </p>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <Button asChild>
          <Link href="/playground">Try the Playground</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/docs">Read the Docs</Link>
        </Button>
      </div>
    </section>
  );
}
