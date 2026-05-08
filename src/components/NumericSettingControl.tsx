import { type WheelEvent as ReactWheelEvent } from "react";
import * as Slider from "@radix-ui/react-slider";

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stepPrecision(step: number) {
  const stepText = step.toString();
  const decimal = stepText.indexOf(".");
  return decimal >= 0 ? stepText.length - decimal - 1 : 0;
}

function normalizeSteppedValue(value: number, min: number, max: number, step: number) {
  const precision = stepPrecision(step);
  const clamped = clampNumber(value, min, max);
  return Number(clamped.toFixed(precision));
}

export function NumericSettingControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const inputMode = stepPrecision(step) > 0 ? "decimal" : "numeric";

  const applyValue = (next: number) => {
    onChange(normalizeSteppedValue(next, min, max, step));
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    applyValue(value + direction * step);
  };

  return (
    <div className="setting-row numeric-setting-row">
      <div className="setting-label">
        <span>{label}</span>
      </div>
      <div className="slider-wrapper" onWheel={handleWheel}>
        <Slider.Root
          className="slider-root"
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(vals) => applyValue(vals[0]!)}
        >
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb className="slider-thumb" aria-label={label} />
        </Slider.Root>
      </div>
      <div className="setting-stepper">
        <button
          className="setting-stepper-button"
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => applyValue(value - step)}
        >
          -
        </button>
        <input
          className="setting-stepper-input"
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const next = parseFloat(e.target.value);
            if (!Number.isNaN(next)) {
              applyValue(next);
            }
          }}
        />
        <button
          className="setting-stepper-button"
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => applyValue(value + step)}
        >
          +
        </button>
      </div>
    </div>
  );
}
