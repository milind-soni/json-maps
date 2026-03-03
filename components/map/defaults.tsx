"use client";

import type {
  MarkerComponentProps,
  PopupComponentProps,
  TooltipComponentProps,
  LayerTooltipComponentProps,
} from "@/lib/spec";
import { MapIcon } from "./icons";

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
          <MapIcon name={icon} size={16} color="#ffffff" strokeWidth={2.5} />
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

const POPUP_STYLE: React.CSSProperties = {
  position: "relative",
  borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#ffffff",
  color: "#111827",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  overflow: "hidden",
  maxWidth: 260,
};

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 6,
  background: "#111827",
  color: "#ffffff",
  padding: "2px 8px",
  fontSize: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  whiteSpace: "nowrap",
};

export function DefaultPopup({ marker }: PopupComponentProps) {
  const popup = marker.popup;
  if (!popup) return null;

  const isRich = typeof popup === "object";
  const title = isRich ? popup.title : marker.label;
  const description = isRich ? popup.description : popup;
  const image = isRich ? popup.image : undefined;

  return (
    <div style={POPUP_STYLE}>
      {image && (
        <div style={{ height: 128, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={title ?? ""}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {title && (
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{title}</div>
        )}
        {description && (
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

export function DefaultTooltip({ text }: TooltipComponentProps) {
  return (
    <div style={TOOLTIP_STYLE}>
      {text}
    </div>
  );
}

export function DefaultLayerTooltip({ properties, columns }: LayerTooltipComponentProps) {
  // Simple text tooltip (single "_text" column = literal string)
  if (columns.length === 1 && columns[0] === "_text") {
    return (
      <div style={{ ...POPUP_STYLE, padding: "6px 10px", fontSize: 12, fontWeight: 500, maxWidth: 280 }}>
        {String(properties._text)}
      </div>
    );
  }

  return (
    <div style={{ ...POPUP_STYLE, padding: "8px 12px", maxWidth: 280 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {columns.map((col) => {
          const value = properties[col];
          if (value === undefined || value === null) return null;
          return (
            <div key={col} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ color: "#6b7280", flexShrink: 0 }}>
                {col}
              </span>
              <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
