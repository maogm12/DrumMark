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
  ariaLabelDecrease,
  ariaLabelIncrease,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ariaLabelDecrease?: string;
  ariaLabelIncrease?: string;
}) {
  const inputMode = stepPrecision(step) > 0 ? "decimal" : "numeric";

  const applyValue = (next: number) => {
    onChange(normalizeSteppedValue(next, min, max, step));
  };

  return (
    <div className="setting-row numeric-setting-row">
      <span className="setting-label-text">{label}</span>
      <div className="setting-stepper">
        <button
          className="setting-stepper-button"
          type="button"
          aria-label={ariaLabelDecrease ?? `Decrease ${label}`}
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
          aria-label={ariaLabelIncrease ?? `Increase ${label}`}
          onClick={() => applyValue(value + step)}
        >
          +
        </button>
      </div>
    </div>
  );
}
