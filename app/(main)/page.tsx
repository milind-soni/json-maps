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
        <p className="text-xs sm:text-sm font-medium text-muted-foreground tracking-widest uppercase mb-4">
          Declarative Maps from JSON
        </p>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-6">
          AI &rarr; JSON &rarr; Map
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
          Describe an interactive map as JSON, get markers, routes, layers, and
          data visualization. AI-ready specs with guardrailed components.
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

      {/* How it works */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="text-xs text-muted-foreground font-mono mb-3">
                01
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Define Your Map Spec
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Describe viewport, layers, markers, routes, and data sources as
                a JSON spec. Every property is typed and validated.
              </p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono mb-3">
                02
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Generates</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Describe what you want in natural language. AI generates a map
                spec constrained to your catalog of layers and components.
              </p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono mb-3">
                03
              </div>
              <h3 className="text-lg font-semibold mb-2">Render the Map</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                One component renders it all. Stream the response and watch
                markers, routes, and layers appear progressively.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code example */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold mb-4">
                Write a map spec
              </h2>
              <p className="text-muted-foreground mb-6">
                Viewport, markers, routes, layers, controls &mdash; all as JSON.
              </p>
              <Code lang="json">{`{
  "center": [-73.98, 40.75],
  "zoom": 12,
  "layers": {
    "cafes": {
      "type": "geojson",
      "data": "https://data.city/cafes.geojson",
      "cluster": true,
      "clusterOptions": {
        "radius": 50,
        "colors": ["#22c55e", "#eab308", "#ef4444"]
      }
    }
  },
  "markers": {
    "home": {
      "coordinates": [-73.98, 40.75],
      "label": "Home",
      "popup": { "title": "My Location" }
    }
  },
  "controls": {
    "zoom": true,
    "compass": true
  }
}`}</Code>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold mb-4">Render it</h2>
              <p className="text-muted-foreground mb-6">
                One component. One spec. Interactive map.
              </p>
              <Code lang="tsx">{`import { MapRenderer } from "json-maps";

const spec = {
  center: [-73.98, 40.75],
  zoom: 12,
  layers: {
    cafes: {
      type: "geojson",
      data: "https://data.city/cafes.geojson",
      cluster: true,
    },
  },
  markers: {
    home: {
      coordinates: [-73.98, 40.75],
      label: "Home",
    },
  },
  controls: { zoom: true, compass: true },
};

export default function MyMap() {
  return <MapRenderer spec={spec} />;
}`}</Code>
            </div>
          </div>
        </div>
      </section>

      {/* Data layers */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold mb-4">
                Data-driven layers
              </h2>
              <p className="text-muted-foreground mb-6">
                Choropleth, heatmap, fill, and circle layers with color scales
                and legends &mdash; all from JSON.
              </p>
              <Code lang="json">{`{
  "layers": {
    "population": {
      "type": "geojson",
      "data": "https://data.gov/states.geojson",
      "style": {
        "fillColor": {
          "type": "continuous",
          "attr": "population",
          "palette": "Sunset",
          "domain": [0, 40000000]
        },
        "opacity": 0.7
      },
      "tooltip": ["name", "population"]
    }
  },
  "legend": {
    "pop": {
      "layer": "population",
      "title": "Population"
    }
  }
}`}</Code>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold mb-4">
                Actions &amp; interactions
              </h2>
              <p className="text-muted-foreground mb-6">
                React callbacks for marker clicks, drags, viewport changes,
                and layer clicks. Full control over interactions.
              </p>
              <Code lang="tsx">{`import { MapRenderer } from "json-maps";

<MapRenderer
  spec={spec}
  onMarkerClick={(id, coords) => {
    console.log("Clicked:", id, coords);
  }}
  onViewportChange={(viewport) => {
    setSpec(prev => ({ ...prev, ...viewport }));
  }}
  onMarkerDragEnd={(id, coords) => {
    updateMarkerPosition(id, coords);
  }}
  onLayerClick={(layerId, coords) => {
    showFeatureDetails(layerId, coords);
  }}
/>`}</Code>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-2xl font-semibold mb-12 text-center">Features</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Declarative Specs",
                desc: "Describe an entire interactive map as JSON. Viewport, layers, markers, routes, controls, legends.",
              },
              {
                title: "Data Layers",
                desc: "Choropleth, heatmap, clusters, fill, and circle layers with data-driven color scales.",
              },
              {
                title: "Streaming",
                desc: "Progressive rendering as JSON streams from AI. Watch markers and layers appear in real time.",
              },
              {
                title: "AI-Ready",
                desc: "Define a catalog of map components. AI generates specs constrained to your catalog.",
              },
              {
                title: "MapLibre Powered",
                desc: "Built on MapLibre GL. Open source, no API keys required. Full access to the underlying map.",
              },
              {
                title: "Interactions",
                desc: "Marker click, drag, viewport change, and layer click callbacks. Controlled viewport with onViewportChange.",
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
          <h2 className="text-2xl font-semibold mb-4">Get started</h2>
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
