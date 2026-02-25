import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Demo } from "@/components/demo";
import { Code } from "@/components/code";
import { CopyButton } from "@/components/copy-button";
import { EmailSignup } from "@/components/email-signup";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-6">
          The map component
          <br />
          <span className="text-muted-foreground">AI can write</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
          One JSON spec. Markers, layers, choropleths, SQL widgets.
          Stream it from any LLM and watch the map build itself.
        </p>

        <Demo />

        <div className="flex items-center justify-center gap-2 border border-border rounded px-4 py-3 mt-12 mx-auto w-fit">
          <code className="text-sm bg-transparent">
            npm install json-maps
          </code>
          <CopyButton text="npm install json-maps" />
        </div>

        <div className="flex gap-3 justify-center mt-6">
          <Button size="lg" asChild>
            <Link href="/playground">Playground</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/docs">Docs</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href="https://github.com/milind-soni/json-maps"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
          </Button>
        </div>
      </section>

      {/* Built for */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                AI applications
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your LLM outputs a JSON spec. MapRenderer renders it. Stream
                the response and watch markers, layers, and choropleths appear
                token by token.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Data dashboards
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Load Parquet, PMTiles, and GeoJSON directly. Add DuckDB SQL
                widgets that query your data in the browser with
                viewport-reactive aggregations.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Rapid prototyping
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                One component, one spec. Go from an idea to an interactive map
                in minutes. Export the schema and hand it to any model as a
                tool definition.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code examples */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold mb-4">
                Wire it to your LLM
              </h2>
              <p className="text-muted-foreground mb-6">
                Stream a JSON spec from any model. The map updates as tokens
                arrive.
              </p>
              <Code lang="tsx">{`import { MapRenderer } from "json-maps";
import { useState } from "react";
import { readStream } from "./stream";

export default function AIMap({ prompt }: { prompt: string }) {
  const [spec, setSpec] = useState({});

  async function generate() {
    const res = await fetch("/api/map", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
    for await (const chunk of readStream(res)) {
      setSpec(JSON.parse(chunk));
    }
  }

  return (
    <>
      <button onClick={generate}>Generate</button>
      <MapRenderer spec={spec} />
    </>
  );
}`}</Code>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold mb-4">
                Data-driven spec
              </h2>
              <p className="text-muted-foreground mb-6">
                Choropleth with legend, tooltips, and a DuckDB SQL
                widget &mdash; all from JSON.
              </p>
              <Code lang="json">{`{
  "layers": {
    "states": {
      "type": "geojson",
      "data": "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json",
      "style": {
        "fillColor": {
          "type": "continuous",
          "attr": "density",
          "palette": "Sunset",
          "domain": [0, 1000]
        }
      },
      "tooltip": ["name", "density"]
    }
  },
  "legend": {
    "density": { "layer": "states", "title": "Density" }
  },
  "widgets": {
    "avg": {
      "sql": {
        "query": "SELECT ROUND(AVG(density)) as avg FROM states",
        "refreshOn": "viewport"
      },
      "value": "{{avg}} per sq mi"
    }
  }
}`}</Code>
            </div>
          </div>
        </div>
      </section>

      {/* Data formats */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="flex items-center justify-center gap-3 text-sm font-mono flex-wrap">
            {["GeoJSON", "Parquet", "PMTiles", "MVT", "Raster"].map(
              (fmt, i) => (
                <span key={fmt} className="flex items-center gap-3">
                  {i > 0 && (
                    <span className="text-muted-foreground/40">
                      &middot;
                    </span>
                  )}
                  <span className="text-foreground">{fmt}</span>
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-2xl font-semibold mb-12 text-center">
            Everything you need
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "JSON schema for LLMs",
                desc: "Export the spec schema and give it to any model as a tool definition. Typed, validated, constrained generation.",
              },
              {
                title: "Progressive streaming",
                desc: "Stream JSON from your AI backend. The map updates token by token as markers, layers, and controls arrive.",
              },
              {
                title: "Browser-native SQL",
                desc: "DuckDB-WASM widgets query your data in the browser. Viewport-reactive aggregations update as users pan and zoom.",
              },
              {
                title: "Modern data formats",
                desc: "Parquet, PMTiles, MVT, raster tiles. Load millions of rows directly from cloud storage without a tile server.",
              },
              {
                title: "One component",
                desc: "<MapRenderer spec={spec} /> with className, style, and children. That's the entire API surface.",
              },
              {
                title: "Production callbacks",
                desc: "onMapClick, onLayerHover, onMarkerDragEnd, onViewportChange, onError. Full control over every interaction.",
              },
            ].map((feature) => (
              <div key={feature.title}>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stay updated */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-lg font-semibold mb-2">Stay updated</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Get notified about new features and updates.
          </p>
          <EmailSignup source="homepage" />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="text-2xl font-semibold mb-4">Start building</h2>
          <div className="flex items-center justify-center gap-2 border border-border rounded px-4 py-3 mb-8 mx-auto w-fit">
            <code className="text-sm bg-transparent">
              npm install json-maps
            </code>
            <CopyButton text="npm install json-maps" />
          </div>
          <div className="flex gap-3 justify-center">
            <Button asChild>
              <Link href="/playground">Try the Playground</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">Documentation</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
