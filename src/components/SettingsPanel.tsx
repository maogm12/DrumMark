import * as Switch from "@radix-ui/react-switch";
import * as Accordion from "@radix-ui/react-accordion";
import { NumericSettingControl } from "./NumericSettingControl";
import type { AppSettings } from "../hooks/useAppSettings";
import type { PagePadding } from "../vexflow/types";

export function SettingsPanel({
  settings,
  updateSetting,
  updatePagePadding,
  debugMode,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updatePagePadding: (key: keyof PagePadding, value: number) => void;
  debugMode: boolean;
}) {
  return (
    <Accordion.Root type="multiple" className="settings-accordion">
      <Accordion.Item value="notation">
        <Accordion.Trigger className="settings-trigger">
          Notation
          <span className="settings-accordion-chevron" aria-hidden />
        </Accordion.Trigger>
        <Accordion.Content className="settings-content">
          <label className="setting-row toggle">
            <span>Hide lower-voice rests</span>
            <Switch.Root
              className="toggle-root"
              checked={settings.hideVoice2Rests}
              onCheckedChange={(checked) => updateSetting("hideVoice2Rests", checked)}
            >
              <Switch.Thumb className="toggle-thumb" />
            </Switch.Root>
          </label>
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="page-layout">
        <Accordion.Trigger className="settings-trigger">
          Page Layout
          <span className="settings-accordion-chevron" aria-hidden />
        </Accordion.Trigger>
        <Accordion.Content className="settings-content">
          <NumericSettingControl
            label="Staff Size"
            value={settings.staffScale}
            min={0.3}
            max={1.5}
            step={0.05}
            onChange={(value) => updateSetting("staffScale", value)}
          />
          <NumericSettingControl
            label="Distance Between Systems"
            value={settings.systemSpacing}
            min={0}
            max={100}
            step={1}
            onChange={(value) => updateSetting("systemSpacing", value)}
          />
          <NumericSettingControl
            label="Note Stem Length"
            value={settings.stemLength}
            min={15}
            max={50}
            step={1}
            onChange={(value) => updateSetting("stemLength", value)}
          />
          <NumericSettingControl
            label="Volta Distance from Notes"
            value={settings.voltaSpacing}
            min={-20}
            max={20}
            step={1}
            onChange={(value) => updateSetting("voltaSpacing", value)}
          />
          <NumericSettingControl
            label="Hairpin Vertical Position"
            value={settings.hairpinOffsetY}
            min={-40}
            max={40}
            step={1}
            onChange={(value) => updateSetting("hairpinOffsetY", value)}
          />
          <div className="padding-grid-container">
            <span className="setting-label-small">Page Margins</span>
            <div className="padding-grid">
              <NumericSettingControl
                label="Top Margin"
                value={settings.pagePadding.top}
                min={0}
                max={800}
                step={1}
                onChange={(value) => updatePagePadding("top", value)}
              />
              <div className="padding-grid-middle">
                <NumericSettingControl
                  label="Left Margin"
                  value={settings.pagePadding.left}
                  min={0}
                  max={400}
                  step={1}
                  onChange={(value) => updatePagePadding("left", value)}
                />
                <NumericSettingControl
                  label="Right Margin"
                  value={settings.pagePadding.right}
                  min={0}
                  max={400}
                  step={1}
                  onChange={(value) => updatePagePadding("right", value)}
                />
              </div>
              <NumericSettingControl
                label="Bottom Margin"
                value={settings.pagePadding.bottom}
                min={0}
                max={800}
                step={1}
                onChange={(value) => updatePagePadding("bottom", value)}
              />
            </div>
          </div>
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="title-area">
        <Accordion.Trigger className="settings-trigger">
          Title Area
          <span className="settings-accordion-chevron" aria-hidden />
        </Accordion.Trigger>
        <Accordion.Content className="settings-content">
          <NumericSettingControl
            label="Title Area Height"
            value={settings.headerHeight}
            min={10}
            max={300}
            step={1}
            onChange={(value) => updateSetting("headerHeight", value)}
          />
          <NumericSettingControl
            label="Distance from Title Area to Staff"
            value={settings.headerStaffSpacing}
            min={0}
            max={100}
            step={1}
            onChange={(value) => updateSetting("headerStaffSpacing", value)}
          />
        </Accordion.Content>
      </Accordion.Item>

      {debugMode && (
        <Accordion.Item value="debug-tempo">
          <Accordion.Trigger className="settings-trigger debug-trigger">
            Debug: Tempo Marking
            <span className="settings-accordion-chevron" aria-hidden />
          </Accordion.Trigger>
          <Accordion.Content className="settings-content">
            <NumericSettingControl
              label="Tempo Marking Left/Right Position"
              value={settings.tempoOffsetX}
              min={-100}
              max={100}
              step={1}
              onChange={(value) => updateSetting("tempoOffsetX", value)}
            />
            <NumericSettingControl
              label="Tempo Marking Up/Down Position"
              value={settings.tempoOffsetY}
              min={-100}
              max={100}
              step={1}
              onChange={(value) => updateSetting("tempoOffsetY", value)}
            />
          </Accordion.Content>
        </Accordion.Item>
      )}
      {debugMode && (
        <Accordion.Item value="debug-measure-numbers">
          <Accordion.Trigger className="settings-trigger debug-trigger">
            Debug: Measure Numbers
            <span className="settings-accordion-chevron" aria-hidden />
          </Accordion.Trigger>
          <Accordion.Content className="settings-content">
            <NumericSettingControl
              label="Measure Number Left/Right Position"
              value={settings.measureNumberOffsetX}
              min={-100}
              max={100}
              step={1}
              onChange={(value) => updateSetting("measureNumberOffsetX", value)}
            />
            <NumericSettingControl
              label="Measure Number Up/Down Position"
              value={settings.measureNumberOffsetY}
              min={-100}
              max={100}
              step={1}
              onChange={(value) => updateSetting("measureNumberOffsetY", value)}
            />
            <NumericSettingControl
              label="Measure Number Size"
              value={settings.measureNumberFontSize}
              min={4}
              max={24}
              step={1}
              onChange={(value) => updateSetting("measureNumberFontSize", value)}
            />
          </Accordion.Content>
        </Accordion.Item>
      )}
      {debugMode && (
        <Accordion.Item value="debug-note-spacing">
          <Accordion.Trigger className="settings-trigger debug-trigger">
            Debug: Note Spacing
            <span className="settings-accordion-chevron" aria-hidden />
          </Accordion.Trigger>
          <Accordion.Content className="settings-content">
            <NumericSettingControl
              label="Duration Spacing Compression"
              value={settings.durationSpacingCompression}
              min={0}
              max={1.5}
              step={0.05}
              onChange={(value) => updateSetting("durationSpacingCompression", value)}
            />
          </Accordion.Content>
        </Accordion.Item>
      )}
      {debugMode && (
        <Accordion.Item value="debug-measure-widths">
          <Accordion.Trigger className="settings-trigger debug-trigger">
            Debug: Measure Widths
            <span className="settings-accordion-chevron" aria-hidden />
          </Accordion.Trigger>
          <Accordion.Content className="settings-content">
            <NumericSettingControl
              label="Measure Width Compression"
              value={settings.measureWidthCompression}
              min={0}
              max={1.5}
              step={0.05}
              onChange={(value) => updateSetting("measureWidthCompression", value)}
            />
          </Accordion.Content>
        </Accordion.Item>
      )}
    </Accordion.Root>
  );
}
