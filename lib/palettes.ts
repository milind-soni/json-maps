// CartoColor palette values (7-step for sequential/diverging, 12 for categorical)
// Source: https://carto.com/carto-colors/

export const PALETTES: Record<string, string[]> = {
  // Sequential
  Burg: ["#ffc6c4", "#f4a3a8", "#e38191", "#cc607d", "#ad466c", "#8b3058", "#672044"],
  RedOr: ["#f6d2a9", "#f5b78e", "#f19c7c", "#ea8171", "#dd686c", "#ca5268", "#b13f64"],
  OrYel: ["#ecda9a", "#efc47e", "#f3ad6a", "#f7945d", "#f97b57", "#f66356", "#ee4d5a"],
  Peach: ["#fde0c5", "#facba6", "#f8b58b", "#f2a275", "#e78f6a", "#d07c5e", "#b86b53"],
  PinkYl: ["#fef6b5", "#ffdd9a", "#ffc285", "#ffa679", "#fa8a76", "#f16d7a", "#e15383"],
  Mint: ["#e4f1e1", "#b4d9cc", "#89c0b6", "#63a6a0", "#448c8a", "#287274", "#0d585f"],
  BluGrn: ["#c4e6c3", "#96d2a4", "#6dbc90", "#4da284", "#36877a", "#266c6e", "#1d4f60"],
  DarkMint: ["#d2fbd4", "#a5dbc2", "#7bbcb0", "#559c9e", "#3a7c89", "#235d72", "#123f5a"],
  Emrld: ["#d3f2a3", "#97e196", "#6cc08b", "#4c9b82", "#217a79", "#105965", "#074050"],
  BluYl: ["#f7feae", "#b7e6a5", "#7ccba2", "#46aea0", "#089099", "#00718b", "#045275"],
  Teal: ["#d1eeea", "#a8dbd9", "#85c4c9", "#68abb8", "#4f90a6", "#3b738f", "#2a5674"],
  Purp: ["#f3e0f7", "#d1bbf0", "#b18fd3", "#8c6bb1", "#6c4f8e", "#4e3a6e", "#2f2047"],
  Sunset: ["#f3e79b", "#fac484", "#f8a07e", "#eb7f86", "#ce6693", "#a059a0", "#5c53a5"],
  SunsetDark: ["#fcde9c", "#faa476", "#f0746e", "#e34f6f", "#dc3977", "#b9257a", "#7c1d6f"],
  Magenta: ["#f3cbd3", "#eaa9bd", "#dd88ac", "#ca699d", "#b14d8e", "#91357d", "#6c2167"],

  // Diverging
  TealRose: ["#009392", "#39b185", "#9ccb86", "#e9e29c", "#eeb479", "#e88471", "#cf597e"],
  Geyser: ["#008080", "#70a494", "#b4c8a8", "#f6edbd", "#edbb8a", "#de8a5a", "#ca562c"],
  Temps: ["#009392", "#39b185", "#9ccb86", "#e9e29c", "#edbb8a", "#e68b5e", "#d43d51"],
  Fall: ["#3d5941", "#778868", "#b5b991", "#f6edbd", "#edbb8a", "#de8a5a", "#ca562c"],
  ArmyRose: ["#798234", "#a3ad62", "#d0d3a2", "#fef2c0", "#f5c0a1", "#ec7d6a", "#d8443c"],
  Tropic: ["#009b9e", "#42b7b9", "#a7d3d4", "#f1eceb", "#e4b4c2", "#ce78a7", "#7c1d6f"],

  // Categorical
  Bold: ["#7F3C8D", "#11A579", "#3969AC", "#F2B701", "#E73F74", "#80BA5A", "#E68310", "#008695", "#CF1C90", "#f97b72", "#4b4b8f", "#A5AA99"],
  Pastel: ["#66C5CC", "#F6CF71", "#F89C74", "#DCB0F2", "#87C55F", "#9EB9F3", "#FE88B1", "#C9DB74", "#8BE0A4", "#B497E7", "#D3B484", "#B3B3B3"],
  Antique: ["#855C75", "#D9AF6B", "#AF6458", "#736F4C", "#526A83", "#625377", "#68855C", "#9C9C5E", "#A06177", "#8C785D", "#467378", "#7C7C7C"],
  Vivid: ["#E58606", "#5D69B1", "#52BCA3", "#99C945", "#CC61B0", "#24796C", "#DAA51B", "#2F8AC4", "#764E9F", "#ED645A", "#CC3A8E", "#A5AA99"],
  Prism: ["#5F4690", "#1D6996", "#38A6A5", "#0F8554", "#73AF48", "#EDAD08", "#E17C05", "#CC503E", "#94346E", "#6F4070", "#994E95", "#666666"],
  Safe: ["#88CCEE", "#CC6677", "#DDCC77", "#117733", "#332288", "#AA4499", "#44AA99", "#999933", "#882255", "#661100", "#6699CC", "#888888"],
};
