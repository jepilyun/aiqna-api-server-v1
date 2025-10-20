// =========================
// Types
// =========================
export type TChunkYouTubeDescription = {
  text: string;      // 청크 본문
  index: number;     // 0-based
  lines: number[];   // 원문 라인 인덱스(디버깅/하이라이트용)
};

export type TChunkYouTubeDescriptionOptions = {
  // 문자/토큰 예산
  maxChars?: number;       // 기본 800
  minChars?: number;       // 기본 250
  overlapChars?: number;   // 기본 120

  // 토큰 기반(선택)
  maxTokens?: number;
  minTokens?: number;
  overlapTokens?: number;
  tokenCounter?: (text: string) => number;

  // 전처리
  cleanText?: boolean;         // 다중 공백/탭 정리 (줄바꿈은 최대 2개 유지)
  dropShortLineUnder?: number; // 이 길이 미만의 라인은 제거(기본 0=미사용)
  stripHashtags?: boolean;     // #hashtag 제거
  stripUrls?: boolean;         // URL 제거
  normalizeBullets?: boolean;  // 불릿 기호 통일(• )

  // 경계/분리 전략
  splitOnDoubleNewlines?: boolean; // 빈 줄 2개 이상을 강한 경계로
  treatRuleLinesAsBoundaries?: boolean; // --- 또는 *** 같은 구분선을 경계로
  treatHeadingsAsBoundaries?: boolean;  // 대문자/이모지/콜론 형태의 단락 제목을 경계로

  // 마이크로 섹션 병합
  coalesceSmallSections?: boolean; // 작은 섹션을 먼저 합침
  minSectionChars?: number;        // 섹션 최소 길이(기본 120)

  // 로그
  verbose?: boolean;
};

// =========================
// Helpers
// =========================
const URL_RE =
  /\b((?:https?:\/\/|www\.)[^\s)]+(?:\([^\s)]+\))?)/gi;
const HASH_RE = /(^|\s)#[\p{Letter}\p{Number}_]+/gu;
const BULLET_RE = /^\s*([-–—•◦▪■●*]|\d+\.)\s+/;
const RULE_RE = /^\s*([-*_]){3,}\s*$/; // --- ___ *** 등의 구분선

// 헤더/단락 제목 추정: 이모지 or 전각문자나 대문자 위주 + 콜론/대시/슬래시 등
export const HEADING_RE =
  /^\s*(?:(?:✅|⭐|🔥|📌|👉|➡️|•|\*|-)|[\p{Lu}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}][^a-z]{0,20})[^a-z]*[-:：–—/]?\s*$/u;

function normalizeLine(l: string, {
  stripUrls,
  stripHashtags,
  normalizeBullets,
}: {
  stripUrls: boolean;
  stripHashtags: boolean;
  normalizeBullets: boolean;
}) {
  let s = l;
  if (stripUrls) s = s.replace(URL_RE, "").trim();
  if (stripHashtags) s = s.replace(HASH_RE, " ").replace(/\s+/g, " ").trim();
  if (normalizeBullets) s = s.replace(BULLET_RE, "• ");
  return s;
}

// =========================
// Main
// =========================
export function chunkYouTubeDescription(
  description: string,
  {
    // 예산 기본값
    maxChars = 800,
    minChars = 250,
    overlapChars = 120,

    maxTokens,
    minTokens,
    overlapTokens,
    tokenCounter,

    // 전처리
    cleanText = true,
    dropShortLineUnder = 0,
    stripHashtags = false,
    stripUrls = false,
    normalizeBullets = true,

    // 경계 전략
    splitOnDoubleNewlines = true,
    treatRuleLinesAsBoundaries = true,
    treatHeadingsAsBoundaries = true,

    // 선병합
    coalesceSmallSections = true,
    minSectionChars = 120,

    verbose = false,
  }: TChunkYouTubeDescriptionOptions = {}
): TChunkYouTubeDescription[] {
  if (!description || !description.trim()) return [];

  // 0) 라인 전처리
  let text = description.replace(/\r\n?/g, "\n");
  if (cleanText) {
    text = text
      .replace(/\t+/g, " ")
      .split("\n")
      .map((l) => l.replace(/[ \u00A0]+$/g, "")) // 각 라인 뒤 공백 제거
      .join("\n")
      .replace(/\n{3,}/g, "\n\n"); // 연속 3개 이상 개행 → 2개
  }

  const rawLines = text.split("\n");
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    let l = normalizeLine(rawLines[i], { stripUrls, stripHashtags, normalizeBullets });
    if (cleanText) l = l.replace(/[ \u00A0]{2,}/g, " ").trim();
    if (dropShortLineUnder > 0 && l.trim().length < dropShortLineUnder) continue;
    lines.push(l);
  }
  if (!lines.length) return [];

  // 1) 경계 식별: 빈 줄, 구분선, 헤딩(옵션)
  const hardBreaks = new Set<number>();
  if (splitOnDoubleNewlines) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "") hardBreaks.add(i);
    }
  }
  const ruleBreaks = new Set<number>();
  if (treatRuleLinesAsBoundaries) {
    for (let i = 0; i < lines.length; i++) {
      if (RULE_RE.test(lines[i])) ruleBreaks.add(i);
    }
  }
  const headingBreaks = new Set<number>();
  if (treatHeadingsAsBoundaries) {
    for (let i = 0; i < lines.length; i++) {
      if (HEADING_RE.test(lines[i])) headingBreaks.add(i);
    }
  }
  const isBreakLine = (i: number) =>
    hardBreaks.has(i) || ruleBreaks.has(i) || headingBreaks.has(i);

  // 2) 섹션 빌드
  type Section = { startLine: number; endLine: number; text: string };
  const sections: Section[] = [];
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i > start && isBreakLine(i)) {
      const slice = lines.slice(start, i).join("\n").trim();
      if (slice) sections.push({ startLine: start, endLine: i - 1, text: slice });
      start = i + 1; // 경계라인 스킵
    }
  }
  if (start < lines.length) {
    const slice = lines.slice(start).join("\n").trim();
    if (slice) sections.push({ startLine: start, endLine: lines.length - 1, text: slice });
  }
  if (!sections.length) {
    sections.push({ startLine: 0, endLine: lines.length - 1, text: lines.join("\n").trim() });
  }

  // 3) 작은 섹션 선병합
  const mergedSections: Section[] = [];
  if (!coalesceSmallSections) {
    mergedSections.push(...sections);
  } else {
    let bucket = sections[0];
    for (let i = 1; i < sections.length; i++) {
      const s = sections[i];
      if ((bucket.text.length < minSectionChars) || (s.text.length < minSectionChars)) {
        bucket = {
          startLine: bucket.startLine,
          endLine: s.endLine,
          text: (bucket.text + "\n" + s.text).replace(/\n{3,}/g, "\n\n").trim(),
        };
      } else {
        mergedSections.push(bucket);
        bucket = s;
      }
    }
    mergedSections.push(bucket);
  }

  // 4) 예산/오버랩 계산
  const useTokens =
    !!tokenCounter && (maxTokens || minTokens || overlapTokens);
  const lengthOf = (t: string) => (useTokens ? tokenCounter!(t) : t.length);

  const maxBudget = useTokens ? (maxTokens ?? Math.round(maxChars / 4)) : maxChars;
  const minBudget = useTokens ? (minTokens ?? Math.round(minChars / 4)) : minChars;
  const overlapBudget = Math.min(
    useTokens ? (overlapTokens ?? Math.round(overlapChars / 4)) : overlapChars,
    maxBudget
  );

  const takeOverlapTailLines = (lineIdxs: number[], need: number): number[] => {
    const out: number[] = [];
    let acc = 0;
    for (let i = lineIdxs.length - 1; i >= 0; i--) {
      const li = lineIdxs[i];
      const t = lines[li] ?? "";
      out.unshift(li);
      acc += lengthOf(t + "\n");
      if (acc >= need) break;
    }
    return out;
  };

  // 5) 메인 청킹
  const chunks: TChunkYouTubeDescription[] = [];
  let bucketLines: number[] = [];

  const pushChunk = (lineIdxs: number[]) => {
    if (!lineIdxs.length) return;
    const txt = lineIdxs.map((i) => lines[i]).join("\n").trim();
    if (!txt) return;
    chunks.push({
      text: txt,
      index: chunks.length,
      lines: lineIdxs.slice(),
    });
  };

  const appendSection = (sec: Section) => {
    const secLines = Array.from({ length: sec.endLine - sec.startLine + 1 }, (_, k) => sec.startLine + k);
    for (const li of secLines) {
      const candidateLines = bucketLines.concat(li);
      const candidateTxt = candidateLines.map((i) => lines[i]).join("\n");
      const candidateLen = lengthOf(candidateTxt);

      if (bucketLines.length > 0 && candidateLen > maxBudget) {
        const currLen = lengthOf(bucketLines.map((i) => lines[i]).join("\n"));
        if (currLen >= Math.max(minBudget, 1)) {
          // 확정 + 오버랩
          pushChunk(bucketLines);
          const tail = takeOverlapTailLines(bucketLines, overlapBudget);
          bucketLines = tail.concat(li);
        } else {
          // 최소 미달이면 일단 오버런 허용
          bucketLines.push(li);
        }
      } else {
        bucketLines.push(li);
      }
    }
  };

  for (const sec of mergedSections) appendSection(sec);
  if (bucketLines.length) pushChunk(bucketLines);

  // 마지막 꼬리 병합(너무 짧으면)
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (lengthOf(last.text) < Math.max(Math.round(minBudget * 0.6), 1)) {
      const merged: TChunkYouTubeDescription = {
        text: (prev.text + "\n" + last.text).replace(/\n{3,}/g, "\n\n").trim(),
        index: prev.index,
        lines: [...prev.lines, ...last.lines],
      };
      chunks.splice(chunks.length - 2, 2, merged);
      chunks.forEach((c, i) => (c.index = i));
    }
  }

  // 1.5배 초과 경고
  if (verbose) {
    const over = chunks.filter(c => lengthOf(c.text) > maxBudget * 1.5);
    if (over.length) {
      console.warn("⚠️ Some description chunks exceed 1.5x budget.");
      over.forEach(c => console.warn(` - #${c.index}: ${lengthOf(c.text)} ${useTokens ? "tokens" : "chars"}`));
    }
  }

  return chunks;
}
