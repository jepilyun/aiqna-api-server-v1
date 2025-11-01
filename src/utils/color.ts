// utils/color.ts
// 문자열 시드로 항상 같은 "파스텔" 색을 만드는 함수 (재렌더에도 색 고정)
export function pastelColorFromSeed(seed: string = "default"): string {
  // 간단 해시 → 0~360 hue
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const s = 55; // 낮은 채도(파스텔)
  const l = 78; // 높은 명도(파스텔)
  return `hsl(${h} ${s}% ${l}%)`; // CSS hsl() 포맷
}

// HEX/HSL/RGB 상관없이 받아서 가독성 좋은 글자색(검/흰) 반환
export function readableTextColor(
  bg: string,
  fallback: string = "#111827",
): string {
  try {
    const { r, g, b } = toRGB(bg);
    // WCAG 상대 휘도 기반 간단 판정
    const luminance = getLuminance(r, g, b);
    return luminance > 0.6 ? "#111827" : "#FFFFFF"; // 밝으면 어두운 글자, 어두우면 흰 글자
  } catch {
    return fallback;
  }
}

function toRGB(input: string): { r: number; g: number; b: number } {
  const s = input.trim().toLowerCase();

  // hsl(h s% l%) 또는 hsl(h, s%, l%)
  const hslMatch = s.match(
    /hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)/,
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const S = parseFloat(hslMatch[2]) / 100;
    const L = parseFloat(hslMatch[3]) / 100;
    // HSL → RGB
    const C = (1 - Math.abs(2 * L - 1)) * S;
    const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = L - C / 2;
    let r1 = 0,
      g1 = 0,
      b1 = 0;
    if (0 <= h && h < 60) [r1, g1, b1] = [C, X, 0];
    else if (60 <= h && h < 120) [r1, g1, b1] = [X, C, 0];
    else if (120 <= h && h < 180) [r1, g1, b1] = [0, C, X];
    else if (180 <= h && h < 240) [r1, g1, b1] = [0, X, C];
    else if (240 <= h && h < 300) [r1, g1, b1] = [X, 0, C];
    else [r1, g1, b1] = [C, 0, X];
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  // rgb(r, g, b)
  const rgbMatch = s.match(/rgb\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*\)/);
  if (rgbMatch) {
    return {
      r: clamp255(parseFloat(rgbMatch[1])),
      g: clamp255(parseFloat(rgbMatch[2])),
      b: clamp255(parseFloat(rgbMatch[3])),
    };
  }

  // #rgb / #rrggbb
  let hex = s;
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) {
    const [r, g, b] = hex.split("");
    hex = r + r + g + g + b + b;
  }
  const num = parseInt(hex, 16);
  if (!Number.isNaN(num) && hex.length === 6) {
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  // 실패 시 기본 파스텔
  return toRGB(pastelColorFromSeed("default"));
}

function getLuminance(r: number, g: number, b: number): number {
  const srgb = [r, g, b]
    .map((v) => v / 255)
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
