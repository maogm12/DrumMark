import * as Switch from "@radix-ui/react-switch";
import * as Accordion from "@radix-ui/react-accordion";
import { NumericSettingControl } from "./NumericSettingControl";
import type { AppSettings } from "../hooks/useAppSettings";
import type { PagePadding } from "../renderer/renderOptions";
import { SETTINGS_RANGES } from "../renderer/renderOptions";
import { useT } from "../i18n/context";
import type { I18nKey } from "../i18n/keys";

function Numeric({
  labelKey,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  labelKey: I18nKey;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  const { t } = useT();
  const label = t(labelKey);
  return (
    <NumericSettingControl
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      unit={unit}
      ariaLabelDecrease={t("settings.decrease", { label })}
      ariaLabelIncrease={t("settings.increase", { label })}
    />
  );
}

function ToggleSetting({
  labelKey,
  checked,
  onCheckedChange,
}: {
  labelKey: I18nKey;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useT();
  return (
    <label className="setting-row toggle">
      <span>{t(labelKey)}</span>
      <Switch.Root className="toggle-root" checked={checked} onCheckedChange={onCheckedChange}>
        <Switch.Thumb className="toggle-thumb" />
      </Switch.Root>
    </label>
  );
}

export function SettingsPanel({
  settings,
  updateSetting,
  updatePagePadding,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updatePagePadding: (key: keyof PagePadding, value: number) => void;
}) {
  const { t } = useT();
  return (
    <Accordion.Root type="multiple" className="settings-accordion" defaultValue={["page-layout", "notation", "staff-header", "debug"]}>
      <Accordion.Item value="page-layout">
        <Accordion.Trigger className="settings-trigger">
          {t("settings.pageLayout")}
          <span className="settings-accordion-chevron" aria-hidden />
        </Accordion.Trigger>
        <Accordion.Content className="settings-content">
          <Numeric labelKey="settings.topMargin" value={settings.pagePadding.top} min={0} max={800} step={1} onChange={(value) => updatePagePadding("top", value)} />
          <Numeric labelKey="settings.bottomMargin" value={settings.pagePadding.bottom} min={0} max={800} step={1} onChange={(value) => updatePagePadding("bottom", value)} />
          <Numeric labelKey="settings.leftMargin" value={settings.pagePadding.left} min={0} max={400} step={1} onChange={(value) => updatePagePadding("left", value)} />
          <Numeric labelKey="settings.rightMargin" value={settings.pagePadding.right} min={0} max={400} step={1} onChange={(value) => updatePagePadding("right", value)} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="notation">
        <Accordion.Trigger className="settings-trigger">
          {t("settings.notes")}
          <span className="settings-accordion-chevron" aria-hidden />
        </Accordion.Trigger>
        <Accordion.Content className="settings-content">
          <ToggleSetting
            labelKey="settings.hideVoice2Rests"
            checked={settings.hideVoice2Rests}
            onCheckedChange={(checked) => updateSetting("hideVoice2Rests", checked)}
          />
          <Numeric labelKey="settings.stemLength" value={settings.stemLength} min={-12} max={12} step={1} onChange={(value) => updateSetting("stemLength", value)} />
        </Accordion.Content>
      </Accordion.Item>

      <Accordion.Item value="staff-header">
        <Accordion.Trigger className="settings-trigger">
          {t("settings.staffLayout")}
          <span className="settings-accordion-chevron" aria-hidden />
        </Accordion.Trigger>
        <Accordion.Content className="settings-content">
          <ToggleSetting labelKey="settings.hideTitle" checked={settings.hideTitle} onCheckedChange={(checked) => updateSetting("hideTitle", checked)} />
          <ToggleSetting labelKey="settings.hideSubtitle" checked={settings.hideSubtitle} onCheckedChange={(checked) => updateSetting("hideSubtitle", checked)} />
          <ToggleSetting labelKey="settings.hideComposer" checked={settings.hideComposer} onCheckedChange={(checked) => updateSetting("hideComposer", checked)} />
          <ToggleSetting labelKey="settings.hideTempo" checked={settings.hideTempo} onCheckedChange={(checked) => updateSetting("hideTempo", checked)} />
          <ToggleSetting labelKey="settings.hideTimeSignature" checked={settings.hideTimeSignature} onCheckedChange={(checked) => updateSetting("hideTimeSignature", checked)} />
          <ToggleSetting labelKey="settings.hideClef" checked={settings.hideClef} onCheckedChange={(checked) => updateSetting("hideClef", checked)} />
          <ToggleSetting labelKey="settings.hideMeasureNumber" checked={settings.hideMeasureNumber} onCheckedChange={(checked) => updateSetting("hideMeasureNumber", checked)} />
          <Numeric labelKey="settings.staffSpacePt" value={settings.staffSpacePt} min={SETTINGS_RANGES.staffSpacePt.min} max={SETTINGS_RANGES.staffSpacePt.max} step={0.5} unit="pt" onChange={(value) => updateSetting("staffSpacePt", value)} />
          <Numeric labelKey="settings.systemSpacing" value={settings.systemSpacing} min={SETTINGS_RANGES.systemSpacing.min} max={SETTINGS_RANGES.systemSpacing.max} step={1} onChange={(value) => updateSetting("systemSpacing", value)} />
          <Numeric labelKey="settings.titleHeight" value={settings.headerHeight} min={SETTINGS_RANGES.headerHeight.min} max={SETTINGS_RANGES.headerHeight.max} step={1} onChange={(value) => updateSetting("headerHeight", value)} />
          <Numeric labelKey="settings.titleGap" value={settings.headerStaffSpacing} min={SETTINGS_RANGES.headerStaffSpacing.min} max={SETTINGS_RANGES.headerStaffSpacing.max} step={1} onChange={(value) => updateSetting("headerStaffSpacing", value)} />
          <Numeric labelKey="settings.voltaOffset" value={settings.voltaSpacing} min={SETTINGS_RANGES.voltaSpacing.min} max={SETTINGS_RANGES.voltaSpacing.max} step={1} onChange={(value) => updateSetting("voltaSpacing", value)} />
          <Numeric labelKey="settings.hairpinOffset" value={settings.hairpinOffsetY} min={SETTINGS_RANGES.hairpinOffsetY.min} max={SETTINGS_RANGES.hairpinOffsetY.max} step={1} onChange={(value) => updateSetting("hairpinOffsetY", value)} />
        </Accordion.Content>
      </Accordion.Item>

    </Accordion.Root>
  );
}
