/**
 * core/sensitivity.js
 * Ba mức nhạy cử chỉ để đổi nhanh ngay khi đang trình chiếu (phím H → chọn mức).
 * Mức "Mạnh" dành cho người đứng xa camera hoặc tay nhỏ trong khung hình.
 */
import { CONFIG } from '../config.js';

export const SENSITIVITY_PRESETS = {
  soft: {
    label: 'Nhẹ (chống nhầm)',
    note: 'Phải chạm sát hẳn — rất ít khi nhận nhầm đáp án.',
    chord: { touchOn: 0.28, touchOff: 0.55, margin: 0.92 },
  },
  normal: {
    label: 'Vừa (khuyên dùng)',
    note: 'Cân bằng giữa độ chính xác và dễ dùng.',
    chord: { touchOn: 0.36, touchOff: 0.62, margin: 0.88 },
  },
  strong: {
    label: 'Mạnh (rất dễ nhận)',
    note: 'Chỉ cần chạm non cũng nhận — đứng xa camera vẫn dùng tốt.',
    chord: { touchOn: 0.46, touchOff: 0.72, margin: 0.82 },
  },
};

export function applySensitivity(name) {
  const preset = SENSITIVITY_PRESETS[name] || SENSITIVITY_PRESETS.normal;
  CONFIG.sensitivity = name in SENSITIVITY_PRESETS ? name : 'normal';
  if (preset.chord) Object.assign(CONFIG.gestures.chord, preset.chord);
  return preset;
}
