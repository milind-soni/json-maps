import { type MapSpec } from "./spec";

const MAX_PROMPT_LENGTH = 500;

const PATCH_INSTRUCTIONS = `IMPORTANT: The current map is already loaded. Output ONLY the patches needed to make the requested change:
- To change a top-level field: {"op":"replace","path":"/basemap","value":"dark"}
- To add a marker: {"op":"add","path":"/markers/new-id","value":{...}}
- To modify a marker: {"op":"replace","path":"/markers/existing-id","value":{...}}
- To remove a marker: {"op":"remove","path":"/markers/old-id"}
- To add a layer: {"op":"add","path":"/layers/new-id","value":{...}}
- To remove a layer: {"op":"remove","path":"/layers/old-id"}
- To set controls: {"op":"replace","path":"/controls","value":{"zoom":true,"compass":true,"fullscreen":true,"position":"top-right"}}
- To add a route: {"op":"add","path":"/layers/my-route","value":{"type":"route","coordinates":[[lng,lat],[lng,lat]],"style":{"color":"#3b82f6","width":3}}}
- To enable clustering: include "cluster":true in the layer value
- To add a legend: {"op":"add","path":"/legend/my-legend","value":{"layer":"layer-id","title":"Legend Title"}}

DO NOT output patches for fields that don't need to change. Only output what's necessary for the requested modification.`;

function isNonEmptySpec(spec: unknown): spec is MapSpec {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as Record<string, unknown>;
  return Object.keys(s).length > 0;
}

export function buildUserPrompt(
  prompt: string,
  previousSpec?: MapSpec | null,
): string {
  const userText = prompt.slice(0, MAX_PROMPT_LENGTH);

  // Refinement mode: existing spec provided
  if (isNonEmptySpec(previousSpec)) {
    const parts: string[] = [];
    parts.push(
      "CURRENT MAP STATE (already loaded, DO NOT recreate existing fields):",
    );
    parts.push(JSON.stringify(previousSpec));
    parts.push("");
    parts.push(`USER REQUEST: ${userText}`);
    parts.push("");
    parts.push(PATCH_INSTRUCTIONS);
    return parts.join("\n");
  }

  // Fresh generation mode
  return userText;
}
