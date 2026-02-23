"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { WidgetSpec, WidgetRowSpec, ViewportBounds } from "@/lib/spec";
import type { SQLQueryResult } from "@/lib/sql-template";
import { resolveWidgetTemplates } from "@/lib/sql-template";
import { ensureTable, executeQuery } from "@/lib/duckdb";
import { layerDataCache } from "@/lib/layer-data-cache";

/** Extract table names referenced in a SQL query (simple heuristic) */
function extractTableNames(sql: string): string[] {
  const matches = sql.matchAll(/\bFROM\s+"?(\w[\w-]*)"?/gi);
  const names = new Set<string>();
  for (const m of matches) names.add(m[1]);
  const joinMatches = sql.matchAll(/\bJOIN\s+"?(\w[\w-]*)"?/gi);
  for (const m of joinMatches) names.add(m[1]);
  return [...names];
}

export function useSQLWidget(
  widget: WidgetSpec,
  bounds: ViewportBounds | null,
): {
  resolvedValue?: string;
  resolvedDescription?: string;
  resolvedRows?: WidgetRowSpec[];
  isInitializing: boolean;
  error: string | null;
} {
  const [result, setResult] = useState<SQLQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Track latest bounds in a ref so the query always uses current bounds
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  // Run ID to discard stale query results (only incremented at query phase, not ensureTable)
  const runIdRef = useRef(0);

  // Subscribe to layer data arrivals so we re-try when tables become available
  useEffect(() => {
    if (!widget.sql) return;
    const tables = extractTableNames(widget.sql.query);

    const unsub = layerDataCache.onData((layerId) => {
      if (tables.includes(layerId)) {
        setDataVersion((v) => v + 1);
      }
    });

    return unsub;
  }, [widget.sql?.query]); // eslint-disable-line react-hooks/exhaustive-deps

  const runQuery = useCallback(async () => {
    if (!widget.sql) return;
    const tables = extractTableNames(widget.sql.query);

    // Phase 1: Ensure tables are ingested (slow on first run — DuckDB init + data ingest)
    // Don't guard with run ID here — this is idempotent and we don't want to discard it
    let allReady = true;
    for (const t of tables) {
      try {
        const ready = await ensureTable(t);
        if (!ready) { allReady = false; break; }
      } catch (e) {
        console.warn(`[sql-widget] Failed to ensure table "${t}":`, e);
        setError(e instanceof Error ? e.message : String(e));
        allReady = false;
        break;
      }
    }
    if (!allReady) return;

    // Phase 2: Execute query — use run ID to discard stale results from rapid viewport changes
    const myRunId = ++runIdRef.current;
    setError(null);
    try {
      const res = await executeQuery(widget.sql.query, boundsRef.current ?? undefined);
      if (myRunId === runIdRef.current) setResult(res);
    } catch (e) {
      console.error("[sql-widget] Query failed:", e);
      if (myRunId === runIdRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [widget.sql?.query, widget.sql]); // eslint-disable-line react-hooks/exhaustive-deps
  // NOTE: bounds intentionally NOT in deps — we read from boundsRef for freshness

  // Track whether "once" mode has completed (prevents re-querying after first success)
  const onceCompleteRef = useRef(false);
  if (result && widget.sql?.refreshOn !== "viewport") {
    onceCompleteRef.current = true;
  }

  // Execute query on mount, data arrival, and viewport changes
  useEffect(() => {
    if (!widget.sql) return;

    const isViewport = widget.sql.refreshOn === "viewport";

    // For "once" mode, stop once we have a result
    if (!isViewport && onceCompleteRef.current) return;

    const delay = isViewport ? (widget.sql.debounce ?? 0) : 0;
    const timer = setTimeout(runQuery, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [runQuery, dataVersion, bounds, widget.sql]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!widget.sql || !result) {
    return { isInitializing: !!widget.sql && !error, error };
  }

  const resolved = resolveWidgetTemplates(widget, result);
  return {
    resolvedValue: resolved.value,
    resolvedDescription: resolved.description,
    resolvedRows: resolved.rows,
    isInitializing: false,
    error,
  };
}
