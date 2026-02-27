export { MapRenderer, useMap, DefaultMarker, DefaultPopup, DefaultTooltip, DefaultLayerTooltip } from "../components/map";

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

// Animation
export { AnimationPlayer } from "../components/animation";
export type { AnimationPlayerProps, AnimationPlayerHandle } from "../components/animation";
export type { AnimationSpec, AnimationKeyframe, TextOverlay, EasingType } from "./animation-spec";
export { interpolateFrame, getTotalFrames, frameToTime } from "./animation-interpolator";
export type { InterpolatedView, InterpolatedFrame } from "./animation-interpolator";
export { validateAnimationSpec, autoFixAnimationSpec } from "./animation-spec-schema";
export { useAnimationStream } from "./use-animation-stream";
export type { UseAnimationStreamOptions, UseAnimationStreamReturn } from "./use-animation-stream";
