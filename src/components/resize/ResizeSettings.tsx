import { LIMITS } from '../../lib/pdf/errors';
import {
  PAPER_SIZES,
  describeTarget,
  fromPoints,
  resolveTargetSize,
  toPoints,
  type FitMode,
  type Orientation,
  type PaperPreset,
  type ResizeSettings as Settings,
  type SizeUnit,
} from '../../lib/pdf/paperSizes';

interface ResizeSettingsProps {
  settings: Settings;
  disabled: boolean;
  onChange: (settings: Settings) => void;
}

const modes: { id: FitMode; label: string; detail: string }[] = [
  {
    id: 'fit',
    label: 'Fit',
    detail: 'Keep the whole page visible. Extra space may be blank.',
  },
  {
    id: 'fill',
    label: 'Fill',
    detail: 'Cover the page. Edges may be cropped.',
  },
  {
    id: 'stretch',
    label: 'Stretch',
    detail: 'Fill the width and height. Content may look stretched.',
  },
];

export default function ResizeSettings({ settings, disabled, onChange }: ResizeSettingsProps) {
  const target = describeTarget(settings);

  function selectPreset(preset: PaperPreset) {
    if (preset !== 'custom') {
      onChange({ ...settings, preset });
      return;
    }
    if (settings.preset === 'custom') return;
    const current = resolveTargetSize(settings);
    onChange({
      ...settings,
      preset: 'custom',
      customWidth: fromPoints(current.width, settings.customUnit),
      customHeight: fromPoints(current.height, settings.customUnit),
    });
  }

  function selectOrientation(orientation: Orientation) {
    if (orientation === settings.orientation) return;
    if (settings.preset !== 'custom') {
      onChange({ ...settings, orientation });
      return;
    }
    onChange({
      ...settings,
      orientation,
      customWidth: settings.customHeight,
      customHeight: settings.customWidth,
    });
  }

  function selectUnit(customUnit: SizeUnit) {
    if (!Number.isFinite(settings.customWidth) || !Number.isFinite(settings.customHeight)) {
      onChange({ ...settings, customUnit });
      return;
    }
    onChange({
      ...settings,
      customUnit,
      customWidth: fromPoints(toPoints(settings.customWidth, settings.customUnit), customUnit),
      customHeight: fromPoints(toPoints(settings.customHeight, settings.customUnit), customUnit),
    });
  }

  return (
    <div className="settings">
      <fieldset className="setting-group" disabled={disabled}>
        <legend>Page size</legend>
        <div className="choices" role="radiogroup" aria-label="Page size">
          {PAPER_SIZES.map((paper) => (
            <label key={paper.id} className={settings.preset === paper.id ? 'choice is-selected' : 'choice'}>
              <input
                className="choice-input"
                type="radio"
                name="page-size"
                value={paper.id}
                checked={settings.preset === paper.id}
                onChange={() => selectPreset(paper.id)}
              />
              <span className="choice-body">
                <span className="choice-label">{paper.label}</span>
                <span className="choice-meta">
                  {settings.orientation === 'landscape'
                    ? `${paper.heightLabel} × ${paper.widthLabel}`
                    : `${paper.widthLabel} × ${paper.heightLabel}`}
                </span>
              </span>
            </label>
          ))}
          <label className={settings.preset === 'custom' ? 'choice is-selected' : 'choice'}>
            <input
              className="choice-input"
              type="radio"
              name="page-size"
              value="custom"
              checked={settings.preset === 'custom'}
              onChange={() => selectPreset('custom')}
            />
            <span className="choice-body">
              <span className="choice-label">Custom</span>
              <span className="choice-meta">Width and height</span>
            </span>
          </label>
        </div>
        {settings.preset === 'custom' ? (
          <div className="custom-size">
            <label>
              Width
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={Number.isFinite(settings.customWidth) ? settings.customWidth : ''}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    customWidth: event.target.value === '' ? Number.NaN : Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Height
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={Number.isFinite(settings.customHeight) ? settings.customHeight : ''}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    customHeight: event.target.value === '' ? Number.NaN : Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Unit
              <select value={settings.customUnit} onChange={(event) => selectUnit(event.target.value as SizeUnit)}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </label>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="setting-group" disabled={disabled}>
        <legend>Orientation</legend>
        <div className="choices choices-two" role="radiogroup" aria-label="Orientation">
          {(['portrait', 'landscape'] as const).map((orientation) => (
            <label key={orientation} className={settings.orientation === orientation ? 'choice is-selected' : 'choice'}>
              <input
                className="choice-input"
                type="radio"
                name="orientation"
                value={orientation}
                checked={settings.orientation === orientation}
                onChange={() => selectOrientation(orientation)}
              />
              <span className="choice-body">
                <span className="choice-label">{orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="setting-note">Page size and content fitting are separate settings.</p>

      <fieldset className="setting-group" disabled={disabled}>
        <legend>How content fits</legend>
        <div className="modes">
          {modes.map((mode) => (
            <label key={mode.id} className={settings.mode === mode.id ? 'mode is-selected' : 'mode'}>
              <input
                className="choice-input"
                type="radio"
                name="fit-mode"
                value={mode.id}
                checked={settings.mode === mode.id}
                onChange={() => onChange({ ...settings, mode: mode.id })}
              />
              <span className="mode-body">
                <span className="choice-label">
                  {mode.label}
                  {mode.id === 'fit' ? ' (recommended)' : ''}
                </span>
                <span className="choice-meta">{mode.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="target-summary">
        {target ? (
          <>
            <span className="target-label">Target page</span> {target}
          </>
        ) : (
          <>Enter a width and height between 1 point and {LIMITS.maxPoints / 72} inches.</>
        )}
      </p>
    </div>
  );
}
