import type { WidgetSpec, WidgetRowSpec } from "./spec";

export interface SQLQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

function resolveTemplate(
  template: string,
  row: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w[\w:.]*)\}\}/g, (_, key) => {
    const val = row[key];
    if (val == null) return "--";
    if (typeof val === "number") return val.toLocaleString();
    return String(val);
  });
}

export function resolveWidgetTemplates(
  widget: WidgetSpec,
  result: SQLQueryResult,
): { value?: string; description?: string; rows?: WidgetRowSpec[] } {
  if (result.rows.length === 0) {
    return { value: "--", description: "No data" };
  }

  const row = result.rows[0];

  return {
    value: widget.value ? resolveTemplate(widget.value, row) : undefined,
    description: widget.description ? resolveTemplate(widget.description, row) : undefined,
    rows: widget.rows?.map((r) => ({
      ...r,
      label: resolveTemplate(r.label, row),
      value: resolveTemplate(r.value, row),
    })),
  };
}
