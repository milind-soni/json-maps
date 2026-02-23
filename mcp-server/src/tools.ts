import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import LZString from "lz-string";
import { MapSpecSchema } from "./schema.js";

const BASE_URL = "https://json-maps.vercel.app";

function compressSpec(spec: unknown): string {
  const json = JSON.stringify(spec);
  return LZString.compressToEncodedURIComponent(json);
}

export function registerTools(server: McpServer) {
  // create_map — generates embed + playground URLs
  server.tool(
    "create_map",
    "Create an interactive map from a JSON spec. Returns viewable and editable URLs.",
    {
      spec: MapSpecSchema.describe("The MapSpec object"),
    },
    async (args) => {
      const raw = args.spec;
      const specObj = typeof raw === "string" ? JSON.parse(raw) : raw;
      const result = MapSpecSchema.safeParse(specObj);

      if (!result.success) {
        const errors = result.error.issues.map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
          return `${path}: ${issue.message}`;
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Validation failed:\n${errors.join("\n")}\n\nFix these issues and try again.`,
            },
          ],
          isError: true,
        };
      }

      const compressed = compressSpec(result.data);
      const embedUrl = `${BASE_URL}/embed#${compressed}`;
      const playgroundUrl = `${BASE_URL}/playground#${compressed}`;

      return {
        content: [
          {
            type: "text" as const,
            text: `Map created!\n\nView: ${embedUrl}\nEdit: ${playgroundUrl}`,
          },
        ],
      };
    },
  );

  // validate_map_spec — validate without creating URLs
  server.tool(
    "validate_map_spec",
    "Validate a json-maps spec without creating a URL. Returns validation errors or confirms the spec is valid.",
    {
      spec: MapSpecSchema.describe("The MapSpec object to validate"),
    },
    async (args) => {
      const result = MapSpecSchema.safeParse(args.spec);

      if (result.success) {
        return {
          content: [{ type: "text" as const, text: "Spec is valid." }],
        };
      }

      const errors = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `${path}: ${issue.message}`;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Validation errors:\n${errors.join("\n")}`,
          },
        ],
        isError: true,
      };
    },
  );
}
