"use client";

import type {
  LegendSpec,
  GeoJsonLayerSpec,
  ContinuousColor,
  CategoricalColor,
  WidgetSpec,
  ViewportBounds,
} from "@/lib/spec";
import { PALETTES } from "@/lib/palettes";
import { useSQLWidget } from "@/hooks/use-sql-widget";
import { POSITION_CLASSES } from "./utils";

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

export function MapLegend({
  legendSpec,
  layerSpec,
  dark,
}: {
  legendSpec: LegendSpec;
  layerSpec: GeoJsonLayerSpec | null;
  dark: boolean;
}) {
  if (!layerSpec || !layerSpec.style) return null;

  const position = legendSpec.position ?? "bottom-left";
  const posClass = POSITION_CLASSES[position] ?? POSITION_CLASSES["bottom-left"];
  const title = legendSpec.title ?? legendSpec.layer;
  const style = layerSpec.style;

  // Find the first data-driven color for the legend
  const colorDef = (style.pointColor ?? style.fillColor ?? style.lineColor) as
    | ContinuousColor
    | CategoricalColor
    | string
    | undefined;

  if (!colorDef || typeof colorDef === "string") return null;

  const palette = PALETTES[colorDef.palette];
  if (!palette || palette.length === 0) return null;

  const cardClass = dark
    ? "rounded-md border border-white/10 bg-black/80 backdrop-blur-sm shadow-md px-3 py-2 text-xs"
    : "rounded-md border border-gray-200 bg-white/95 backdrop-blur-sm shadow-md px-3 py-2 text-xs";
  const titleClass = dark ? "font-semibold text-white mb-1.5" : "font-semibold text-gray-800 mb-1.5";

  return (
    <div className={`absolute ${posClass} z-10`}>
      <div className={cardClass}>
        <div className={titleClass}>{title}</div>
        {colorDef.type === "continuous" && (
          <ContinuousLegend colorDef={colorDef} palette={palette} dark={dark} />
        )}
        {colorDef.type === "categorical" && (
          <CategoricalLegend colorDef={colorDef} palette={palette} dark={dark} />
        )}
      </div>
    </div>
  );
}

function ContinuousLegend({
  colorDef,
  palette,
  dark,
}: {
  colorDef: ContinuousColor;
  palette: string[];
  dark: boolean;
}) {
  const [min, max] = colorDef.domain ?? [0, 1];
  const gradient = `linear-gradient(to right, ${palette.join(", ")})`;

  return (
    <div>
      <div
        className="h-2.5 w-36 rounded-sm"
        style={{ background: gradient }}
      />
      <div className={`flex justify-between mt-0.5 text-[10px] ${dark ? "text-gray-400" : "text-gray-500"}`}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function CategoricalLegend({
  colorDef,
  palette,
  dark,
}: {
  colorDef: CategoricalColor;
  palette: string[];
  dark: boolean;
}) {
  const categories = colorDef.categories ?? [];
  if (categories.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {categories.map((cat, i) => (
        <div key={cat} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: palette[i % palette.length] }}
          />
          <span className={`truncate ${dark ? "text-gray-300" : "text-gray-600"}`}>{cat}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Widget overlay                                                     */
/* ------------------------------------------------------------------ */

function MapWidgetCard({ widget, dark }: { widget: WidgetSpec; dark: boolean }) {
  const cardClass = dark
    ? "rounded-lg border border-white/10 bg-black/80 backdrop-blur-md shadow-lg px-3 py-2.5"
    : "rounded-lg border border-gray-200/60 bg-white/95 backdrop-blur-md shadow-lg px-3 py-2.5";

  return (
    <div className={cardClass}>
      {widget.title && (
        <div className={`text-[10px] uppercase tracking-wider mb-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>
          {widget.title}
        </div>
      )}
      {widget.value && (
        <div className={`text-2xl font-semibold leading-tight ${dark ? "text-white" : "text-gray-900"}`}>
          {widget.value}
        </div>
      )}
      {widget.description && (
        <div className={`text-xs mt-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>
          {widget.description}
        </div>
      )}
      {widget.rows && widget.rows.length > 0 && (
        <div className={`${widget.title || widget.value ? "mt-2 pt-2" : ""} ${widget.title || widget.value ? (dark ? "border-t border-white/10" : "border-t border-gray-200/60") : ""} space-y-1`}>
          {widget.rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-xs">
              <span className={dark ? "text-gray-400" : "text-gray-500"}>{row.label}</span>
              <span
                className={`font-medium ${row.color ? "" : (dark ? "text-white" : "text-gray-900")}`}
                style={row.color ? { color: row.color } : undefined}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SQLWidgetCard({
  widget,
  dark,
  bounds,
}: {
  widget: WidgetSpec;
  dark: boolean;
  bounds: ViewportBounds | null;
}) {
  const { resolvedValue, resolvedDescription, resolvedRows, isInitializing, error } =
    useSQLWidget(widget, bounds);

  const resolvedWidget: WidgetSpec = {
    ...widget,
    value: resolvedValue ?? widget.value,
    description: error ? `SQL error: ${error}` : (resolvedDescription ?? widget.description),
    rows: resolvedRows ?? widget.rows,
  };

  return (
    <div className="relative">
      <MapWidgetCard widget={resolvedWidget} dark={dark} />
      {isInitializing && (
        <div className="absolute top-2 right-2">
          <div
            className={`w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin ${dark ? "border-gray-500" : "border-gray-400"}`}
          />
        </div>
      )}
    </div>
  );
}

export function MapWidgets({
  widgets,
  dark,
  bounds,
}: {
  widgets: Record<string, WidgetSpec>;
  dark: boolean;
  bounds?: ViewportBounds | null;
}) {
  // Group widgets by position so they stack instead of overlapping
  const grouped: Record<string, Array<[string, WidgetSpec]>> = {};
  for (const [id, widget] of Object.entries(widgets)) {
    const pos = widget.position ?? "top-left";
    if (!grouped[pos]) grouped[pos] = [];
    grouped[pos].push([id, widget]);
  }

  return (
    <>
      {Object.entries(grouped).map(([position, items]) => {
        const posClass = POSITION_CLASSES[position] ?? POSITION_CLASSES["top-left"];
        const isBottom = position.startsWith("bottom");
        return (
          <div key={position} className={`absolute ${posClass} z-10 flex flex-col ${isBottom ? "items-start flex-col-reverse" : "items-start"} gap-2`}>
            {items.map(([id, widget]) =>
              widget.sql ? (
                <SQLWidgetCard key={id} widget={widget} dark={dark} bounds={bounds ?? null} />
              ) : (
                <MapWidgetCard key={id} widget={widget} dark={dark} />
              ),
            )}
          </div>
        );
      })}
    </>
  );
}
