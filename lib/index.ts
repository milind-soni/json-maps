export { MapRenderer, useMap, DefaultMarker, DefaultPopup, DefaultTooltip, DefaultLayerTooltip, getLayerId } from "../components/map";

export type {
  MapSpec,
  MapViewport,
  MapRendererProps,
  MapComponents,
  MarkerComponentProps,
  PopupComponentProps,
  TooltipComponentProps,
  LayerTooltipComponentProps,
  MarkerSpec,
  PopupSpec,
  GeoJsonLayerSpec,
  RouteLayerSpec,
  HeatmapLayerSpec,
  VectorTileLayerSpec,
  RasterTileLayerSpec,
  ParquetLayerSpec,
  PMTilesLayerSpec,
  RouteProfile,
  RouteStyle,
  LayerSpec,
  LayerStyle,
  ColorValue,
  ContinuousColor,
  CategoricalColor,
  SizeValue,
  ContinuousSize,
  ClusterOptions,
  ControlsSpec,
  ControlPosition,
  LegendSpec,
  WidgetSpec,
  WidgetRowSpec,
  SQLWidgetConfig,
  ViewportBounds,
  MapError,
} from "./spec";

export { BASEMAP_STYLES, resolveBasemapStyle } from "./spec";
export { PALETTES } from "./palettes";
export { validateSpec, autoFixSpec, formatSpecIssues } from "./spec-schema";
export { osrmProvider, mapboxProvider } from "./routing";
export type { RoutingProvider, RoutingRequest } from "./routing";

// AI generation utilities
export { generateSystemPrompt } from "./catalog";
export type { SystemPromptOptions } from "./catalog";
export { buildUserPrompt } from "./prompt";
export { useMapStream } from "./use-map-stream";
export type { UseMapStreamOptions, UseMapStreamReturn, TokenUsage, ToolCall } from "./use-map-stream";

// Story rendering
export { StoryRenderer } from "../components/story";
export type {
  StorySpec,
  StoryChapter,
  StoryMedia,
  StoryOverlay,
  StoryTheme,
  StoryLayout,
  StoryEasing,
  StoryRendererProps,
} from "./story-spec";
export { validateStorySpec, autoFixStorySpec, formatStorySpecIssues } from "./story-spec-schema";
export { useStoryStream } from "./use-story-stream";
export type { UseStoryStreamOptions, UseStoryStreamReturn, StoryToolCall } from "./use-story-stream";
