import { LIMITS, ResizeError, messages } from './errors';

export type FitMode = 'fit' | 'fill' | 'stretch';
export type Orientation = 'portrait' | 'landscape';
export type SizeUnit = 'mm' | 'cm' | 'in';
export type PaperPreset =
  | 'a3'
  | 'a4'
  | 'a5'
  | 'letter'
  | 'legal'
  | 'tabloid'
  | 'custom';

export interface PaperSize {
  id: Exclude<PaperPreset, 'custom'>;
  label: string;
  width: number;
  height: number;
  widthLabel: string;
  heightLabel: string;
}

export const PAPER_SIZES: readonly PaperSize[] = [
  { id: 'a3', label: 'A3', width: 841.89, height: 1190.55, widthLabel: '297 mm', heightLabel: '420 mm' },
  { id: 'a4', label: 'A4', width: 595.28, height: 841.89, widthLabel: '210 mm', heightLabel: '297 mm' },
  { id: 'a5', label: 'A5', width: 419.53, height: 595.28, widthLabel: '148 mm', heightLabel: '210 mm' },
  { id: 'letter', label: 'Letter', width: 612, height: 792, widthLabel: '8.5 in', heightLabel: '11 in' },
  { id: 'legal', label: 'Legal', width: 612, height: 1008, widthLabel: '8.5 in', heightLabel: '14 in' },
  { id: 'tabloid', label: 'Tabloid', width: 792, height: 1224, widthLabel: '11 in', heightLabel: '17 in' },
];

const POINTS_PER_INCH = 72;
const POINTS_PER_MM = 72 / 25.4;

export interface ResizeSettings {
  preset: PaperPreset;
  orientation: Orientation;
  mode: FitMode;
  customWidth: number;
  customHeight: number;
  customUnit: SizeUnit;
}

export const defaultSettings: ResizeSettings = {
  preset: 'a4',
  orientation: 'portrait',
  mode: 'fit',
  customWidth: 210,
  customHeight: 297,
  customUnit: 'mm',
};

export function toPoints(value: number, unit: SizeUnit): number {
  if (unit === 'in') return value * POINTS_PER_INCH;
  if (unit === 'cm') return value * POINTS_PER_MM * 10;
  return value * POINTS_PER_MM;
}

export function fromPoints(value: number, unit: SizeUnit): number {
  const raw =
    unit === 'in' ? value / POINTS_PER_INCH : unit === 'cm' ? value / (POINTS_PER_MM * 10) : value / POINTS_PER_MM;
  return Math.round(raw * 100) / 100;
}

export function paperById(id: Exclude<PaperPreset, 'custom'>): PaperSize {
  const paper = PAPER_SIZES.find((item) => item.id === id);
  if (!paper) throw new ResizeError('invalid_size', messages.invalidSize);
  return paper;
}

export function resolveTargetSize(settings: ResizeSettings): { width: number; height: number } {
  let width: number;
  let height: number;

  if (settings.preset === 'custom') {
    if (!Number.isFinite(settings.customWidth) || !Number.isFinite(settings.customHeight)) {
      throw new ResizeError('invalid_size', messages.invalidSize);
    }
    width = toPoints(settings.customWidth, settings.customUnit);
    height = toPoints(settings.customHeight, settings.customUnit);
  } else {
    const paper = paperById(settings.preset);
    width = paper.width;
    height = paper.height;
    if (settings.orientation === 'landscape') {
      [width, height] = [height, width];
    }
  }

  if (
    width < LIMITS.minPoints ||
    height < LIMITS.minPoints ||
    width > LIMITS.maxPoints ||
    height > LIMITS.maxPoints
  ) {
    throw new ResizeError('invalid_size', messages.invalidSize);
  }

  return { width, height };
}

export function formatPoints(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function describeTarget(settings: ResizeSettings): string | null {
  try {
    if (settings.preset === 'custom') {
      const { width, height } = resolveTargetSize(settings);
      return `${settings.customWidth} × ${settings.customHeight} ${settings.customUnit} (${formatPoints(width)} × ${formatPoints(height)} pt)`;
    }
    const paper = paperById(settings.preset);
    const landscape = settings.orientation === 'landscape';
    const widthLabel = landscape ? paper.heightLabel : paper.widthLabel;
    const heightLabel = landscape ? paper.widthLabel : paper.heightLabel;
    const { width, height } = resolveTargetSize(settings);
    return `${paper.label}, ${widthLabel} × ${heightLabel} (${formatPoints(width)} × ${formatPoints(height)} pt)`;
  } catch {
    return null;
  }
}
