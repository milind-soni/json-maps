import { Header } from "@/components/header";

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto py-12">
          <h1 className="text-3xl font-semibold mb-4">Documentation</h1>
          <p className="text-muted-foreground mb-8">
            Coming soon. json-maps is under active development.
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">Installation</h2>
              <div className="border border-border rounded p-4 bg-neutral-100 dark:bg-[#0a0a0a] font-mono text-sm">
                npm install @json-maps/react
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Quick Start</h2>
              <div className="border border-border rounded p-4 bg-neutral-100 dark:bg-[#0a0a0a] font-mono text-sm whitespace-pre">{`import { MapRenderer } from "@json-maps/react";

const spec = {
  viewport: { center: [-73.98, 40.75], zoom: 12 },
  markers: {
    home: { position: [-73.98, 40.75], label: "Home" }
  },
  controls: { zoom: true }
};

<MapRenderer spec={spec} />`}</div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Layer Types</h2>
              <div className="grid gap-3">
                {[
                  { name: "marker", desc: "Individual pins with popups and tooltips" },
                  { name: "route", desc: "LineString paths between coordinates" },
                  { name: "cluster", desc: "Clustered point data from GeoJSON" },
                  { name: "fill", desc: "Colored polygons (choropleth)" },
                  { name: "heatmap", desc: "Density heatmap visualization" },
                  { name: "circle", desc: "Data-driven sized and colored circles" },
                ].map((layer) => (
                  <div key={layer.name} className="border border-border rounded p-3">
                    <code className="text-sm font-mono bg-secondary px-1.5 py-0.5 rounded">
                      {layer.name}
                    </code>
                    <span className="text-sm text-muted-foreground ml-2">
                      {layer.desc}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
