import { useEffect, useState } from "react";
import type { PagePadding } from "../vexflow/types";

export type MainTab = "editor" | "page" | "xml";

export interface AppSettings {
  hideVoice2Rests: boolean;
  pagePadding: PagePadding;
  staffScale: number;
  headerStaffSpacing: number;
  systemSpacing: number;
  stemLength: number;
  voltaSpacing: number;
  hairpinOffsetY: number;
  headerHeight: number;
  activeTab: MainTab;
  tempoOffsetX: number;
  tempoOffsetY: number;
  measureNumberOffsetX: number;
  measureNumberOffsetY: number;
  measureNumberFontSize: number;
  durationSpacingCompression: number;
  measureWidthCompression: number;
}

export const defaultSettings: AppSettings = {
  hideVoice2Rests: false,
  pagePadding: { top: 30, right: 50, bottom: 30, left: 50 },
  staffScale: 0.75,
  headerStaffSpacing: 60,
  headerHeight: 50,
  systemSpacing: 30,
  stemLength: 31,
  voltaSpacing: -15,
  hairpinOffsetY: -15,
  activeTab: "page",
  tempoOffsetX: 0,
  tempoOffsetY: 0,
  measureNumberOffsetX: 0,
  measureNumberOffsetY: 8,
  measureNumberFontSize: 10,
  durationSpacingCompression: 0.6,
  measureWidthCompression: 0.75,
};

export function useAppSettings() {
  const [settingsVisible, setSettingsVisible] = useState(true);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("drummark-settings");
    if (!saved) return defaultSettings;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.stemLength === undefined || parsed.stemLength < 20 || parsed.stemLength > 40) {
        parsed.stemLength = 31;
      }
      if (parsed.voltaSpacing === undefined || parsed.voltaSpacing < -16 || parsed.voltaSpacing > 16) {
        parsed.voltaSpacing = -15;
      }
      if (parsed.hairpinOffsetY === undefined || parsed.hairpinOffsetY < -40 || parsed.hairpinOffsetY > 40) {
        parsed.hairpinOffsetY = -15;
      }
      if (parsed.headerHeight === undefined) {
        parsed.headerHeight = 50;
      }
      if (parsed.durationSpacingCompression === undefined || parsed.durationSpacingCompression < 0 || parsed.durationSpacingCompression > 1.5) {
        parsed.durationSpacingCompression = 0.6;
      }
      if (parsed.measureWidthCompression === undefined || parsed.measureWidthCompression < 0 || parsed.measureWidthCompression > 1.5) {
        parsed.measureWidthCompression = 0.75;
      }
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
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
