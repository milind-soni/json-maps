"use client";

import type {
  MarkerComponentProps,
  PopupComponentProps,
  TooltipComponentProps,
  LayerTooltipComponentProps,
} from "@/lib/spec";
import { DynamicIcon } from "lucide-react/dynamic";

export function DefaultMarker({ marker, color }: MarkerComponentProps) {
  const { icon, label } = marker;
  const size = icon ? 28 : 16;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {icon ? (
        <div
          className="relative flex items-center justify-center w-7 h-7 rounded-full transition-transform duration-150 hover:scale-[1.15]"
          style={{
            background: color,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <DynamicIcon name={icon as any} size={16} color="#ffffff" strokeWidth={2.5} />
        </div>
      ) : (
        <div
          className="relative rounded-full border-2 border-white transition-transform duration-150 hover:scale-[1.3]"
          style={{
            width: size,
            height: size,
            background: color,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          }}
        />
      )}
      {label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium pointer-events-none"
          style={{
            top: "100%",
            marginTop: 4,
            textShadow:
              "0 0 4px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function DefaultPopup({ marker }: PopupComponentProps) {
  const popup = marker.popup;
  if (!popup) return null;

  const isRich = typeof popup === "object";
  const title = isRich ? popup.title : marker.label;
  const description = isRich ? popup.description : popup;
  const image = isRich ? popup.image : undefined;

  return (
    <div className="relative rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden max-w-[260px] animate-in fade-in-0 zoom-in-95">
      {image && (
        <div className="h-32 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={title ?? ""}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3 space-y-1">
        {title && (
          <div className="font-semibold text-sm leading-tight">{title}</div>
        )}
        {description && (
          <div className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

export function DefaultTooltip({ text }: TooltipComponentProps) {
  return (
    <div className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap animate-in fade-in-0 zoom-in-95">
      {text}
    </div>
  );
}

export function DefaultLayerTooltip({ properties, columns }: LayerTooltipComponentProps) {
  // Simple text tooltip (single "_text" column = literal string)
  if (columns.length === 1 && columns[0] === "_text") {
    return (
      <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-2.5 py-1.5 max-w-[280px] text-xs font-medium">
        {String(properties._text)}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 max-w-[280px]">
      <div className="space-y-0.5">
        {columns.map((col) => {
          const value = properties[col];
          if (value === undefined || value === null) return null;
          return (
            <div key={col} className="flex gap-2 text-xs leading-relaxed">
              <span className="text-muted-foreground shrink-0">
                {col}
              </span>
              <span className="font-medium truncate">{String(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
