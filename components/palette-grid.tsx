"use client";

import { PALETTES } from "@/lib/palettes";

const GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Sequential",
    keys: ["Burg", "RedOr", "OrYel", "Peach", "PinkYl", "Mint", "BluGrn", "DarkMint", "Emrld", "BluYl", "Teal", "Purp", "Sunset", "SunsetDark", "Magenta"],
  },
  {
    label: "Diverging",
    keys: ["TealRose", "Geyser", "Temps", "Fall", "ArmyRose", "Tropic"],
  },
  {
    label: "Categorical",
    keys: ["Bold", "Pastel", "Antique", "Vivid", "Prism", "Safe"],
  },
];

export function PaletteGrid() {
  return (
    <div className="space-y-6 my-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.label}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {group.keys.map((name) => {
              const colors = PALETTES[name];
              if (!colors) return null;
              const isCategorical = group.label === "Categorical";
              return (
                <div key={name} className="flex items-center gap-2">
                  <code className="text-xs w-24 shrink-0">{name}</code>
                  {isCategorical ? (
                    <div className="flex h-5 flex-1 rounded-sm overflow-hidden">
                      {colors.map((c, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="h-5 flex-1 rounded-sm"
                      style={{ background: `linear-gradient(to right, ${colors.join(", ")})` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
