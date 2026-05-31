import { useEffect, useState } from "preact/compat";
import type { PagePadding } from "../renderer/renderOptions";
import { SETTINGS_RANGES } from "../renderer/renderOptions";

export type MainTab = "editor" | "page" | "xml";

export type PagePreviewLayout = {
  pagePadding: PagePadding;
  staffSpacePt: number;
  headerHeight: number;
  headerStaffSpacing: number;
  systemSpacing: number;
  stemLength: number;
  voltaSpacing: number;
  hairpinOffsetY: number;
  hideVoice2Rests: boolean;
  hideTitle: boolean;
  hideSubtitle: boolean;
  hideComposer: boolean;
  hideTempo: boolean;
  hideTimeSignature: boolean;
  hideClef: boolean;
  hideMeasureNumber: boolean;
};

export interface AppSettings {
  hideVoice2Rests: boolean;
  hideTitle: boolean;
  hideSubtitle: boolean;
  hideComposer: boolean;
  hideTempo: boolean;
  hideTimeSignature: boolean;
  hideClef: boolean;
  hideMeasureNumber: boolean;
  pagePadding: PagePadding;
  staffSpacePt: number;
  headerStaffSpacing: number;
  systemSpacing: number;
  stemLength: number;
  voltaSpacing: number;
  hairpinOffsetY: number;
  headerHeight: number;
  activeTab: MainTab;
}

export function pickPagePreviewLayout(settings: AppSettings): PagePreviewLayout {
  return {
    pagePadding: settings.pagePadding,
    staffSpacePt: settings.staffSpacePt,
    headerHeight: settings.headerHeight,
    headerStaffSpacing: settings.headerStaffSpacing,
    systemSpacing: settings.systemSpacing,
    stemLength: settings.stemLength,
    voltaSpacing: settings.voltaSpacing,
    hairpinOffsetY: settings.hairpinOffsetY,
    hideVoice2Rests: settings.hideVoice2Rests,
    hideTitle: settings.hideTitle,
    hideSubtitle: settings.hideSubtitle,
    hideComposer: settings.hideComposer,
    hideTempo: settings.hideTempo,
    hideTimeSignature: settings.hideTimeSignature,
    hideClef: settings.hideClef,
    hideMeasureNumber: settings.hideMeasureNumber,
  };
}

export const defaultSettings: AppSettings = {
  hideVoice2Rests: false,
  hideTitle: false,
  hideSubtitle: false,
  hideComposer: false,
  hideTempo: false,
  hideTimeSignature: false,
  hideClef: false,
  hideMeasureNumber: false,
  pagePadding: { top: 30, right: 50, bottom: 30, left: 50 },
  staffSpacePt: 5.0,
  headerStaffSpacing: 60,
  headerHeight: 50,
  systemSpacing: 30,
  stemLength: 0,
  voltaSpacing: 0,
  hairpinOffsetY: 0,
  activeTab: "page",
};

export function resolveAppSettings(saved: string | null): AppSettings {
  if (!saved) return defaultSettings;
  try {
    const parsed = JSON.parse(saved) as Partial<AppSettings> & { useLayoutEngine?: unknown; staffScale?: number };
    const {
      useLayoutEngine: _legacyRenderer,
      staffScale: legacyStaffScale,
      tempoOffsetX: _legacyTempoOffsetX,
      tempoOffsetY: _legacyTempoOffsetY,
      measureNumberOffsetX: _legacyMeasureNumberOffsetX,
      measureNumberOffsetY: _legacyMeasureNumberOffsetY,
      measureNumberFontSize: _legacyMeasureNumberFontSize,
      durationSpacingCompression: _legacyDurationSpacingCompression,
      measureWidthCompression: _legacyMeasureWidthCompression,
      ...rendererNeutralSettings
    } = parsed as Partial<AppSettings> & {
      useLayoutEngine?: unknown;
      staffScale?: number;
      tempoOffsetX?: unknown;
      tempoOffsetY?: unknown;
      measureNumberOffsetX?: unknown;
      measureNumberOffsetY?: unknown;
      measureNumberFontSize?: unknown;
      durationSpacingCompression?: unknown;
      measureWidthCompression?: unknown;
    };
    void _legacyRenderer;
    void _legacyTempoOffsetX;
    void _legacyTempoOffsetY;
    void _legacyMeasureNumberOffsetX;
    void _legacyMeasureNumberOffsetY;
    void _legacyMeasureNumberFontSize;
    void _legacyDurationSpacingCompression;
    void _legacyMeasureWidthCompression;
    if (legacyStaffScale !== undefined) {
      rendererNeutralSettings.staffSpacePt = 5.0 * legacyStaffScale / 0.75;
    }
    const r = SETTINGS_RANGES;
    if (
      rendererNeutralSettings.staffSpacePt === undefined
      || rendererNeutralSettings.staffSpacePt < r.staffSpacePt.min
      || rendererNeutralSettings.staffSpacePt > r.staffSpacePt.max
    ) {
      rendererNeutralSettings.staffSpacePt = r.staffSpacePt.default;
    }
    if (rendererNeutralSettings.stemLength === undefined) {
      rendererNeutralSettings.stemLength = r.stemLength.default;
    } else if (
      rendererNeutralSettings.stemLength >= -2
      && rendererNeutralSettings.stemLength <= 4
      && Math.abs(rendererNeutralSettings.stemLength * 2 - Math.round(rendererNeutralSettings.stemLength * 2)) < 0.001
    ) {
      // Legacy staff-space offset (−2…+4, step 0.5) → pt.
      const staff = rendererNeutralSettings.staffSpacePt ?? defaultSettings.staffSpacePt;
      rendererNeutralSettings.stemLength = rendererNeutralSettings.stemLength * staff;
    }
    if (
      rendererNeutralSettings.stemLength < r.stemLength.min
      || rendererNeutralSettings.stemLength > r.stemLength.max
    ) {
      rendererNeutralSettings.stemLength = r.stemLength.default;
    }
    if (rendererNeutralSettings.voltaSpacing === undefined || rendererNeutralSettings.voltaSpacing < r.voltaSpacing.min || rendererNeutralSettings.voltaSpacing > r.voltaSpacing.max) {
      rendererNeutralSettings.voltaSpacing = r.voltaSpacing.default;
    }
    if (rendererNeutralSettings.hairpinOffsetY === undefined || rendererNeutralSettings.hairpinOffsetY < r.hairpinOffsetY.min || rendererNeutralSettings.hairpinOffsetY > r.hairpinOffsetY.max) {
      rendererNeutralSettings.hairpinOffsetY = r.hairpinOffsetY.default;
    }
    if (rendererNeutralSettings.headerHeight === undefined || rendererNeutralSettings.headerHeight < r.headerHeight.min || rendererNeutralSettings.headerHeight > r.headerHeight.max) {
      rendererNeutralSettings.headerHeight = r.headerHeight.default;
    }
    return { ...defaultSettings, ...rendererNeutralSettings };
  } catch {
    return defaultSettings;
  }
}

export function useAppSettings() {
  const [settingsVisible, setSettingsVisible] = useState(true);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("drummark-settings");
    return resolveAppSettings(saved);
  });

  useEffect(() => {
    if (settings.activeTab !== "page") {
      setSettingsVisible(false);
    }
  }, [settings.activeTab]);

  useEffect(() => {
    localStorage.setItem("drummark-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updatePagePadding = (key: keyof PagePadding, value: number) => {
    setSettings((prev) => ({
      ...prev,
      pagePadding: { ...prev.pagePadding, [key]: value },
    }));
  };

  return {
    settings,
    updateSetting,
    updatePagePadding,
    settingsVisible,
    setSettingsVisible,
  };
}
