import { TPineconeTranscriptSegment } from "aiqna_common_v1";

type Chunk = { text: string; startTime: number; endTime: number };

type Options = {
  // === 기존 옵션(후방호환) ===
  maxChars?: number;         // 청크 최대 길이(문자)
  overlapChars?: number;     // 겹침 길이(문자)
  maxDurationSec?: number;   // 청크 최대 길이(초)
  minChars?: number;         // 너무 짧은 청크 방지 하한(문자)

  // === 확장 옵션(선택) ===
  minDurationSec?: number;   // 청크 최소 길이(초)
  mergeSmallTail?: boolean;  // 마지막 꼬리 청크가 너무 짧으면 이전 청크와 병합
  cleanText?: boolean;       // [음악], >> 등 잡음 제거
  dropShortSegUnder?: number;// 전처리 후 이 길이 미만 세그먼트 드롭(문자)

  // 토큰 기반 예산(선택): tokenCounter 제공 시 우선 사용
  maxTokens?: number;
  overlapTokens?: number;
  minTokens?: number;        // ★ 추가: 토큰 기준 최소 하한
  tokenCounter?: (text: string) => number; // 예: tiktoken 등

  // ★ 추가: 마이크로 세그먼트 선병합
  useCoalesce?: boolean;
  coalesceMaxGapSec?: number;      // 인접 세그 간 최대 갭(초)
  coalesceMinGroupChars?: number;  // 그룹 최소 글자 길이(문자)
};

/** 내부: 마이크로 세그먼트 병합 */
function coalesceSmallSegments(
  segs: TPineconeTranscriptSegment[],
  maxGapSec: number,
  minGroupChars: number
): TPineconeTranscriptSegment[] {
  if (!segs.length) return segs;
  const out: TPineconeTranscriptSegment[] = [];
  let bucket: TPineconeTranscriptSegment[] = [segs[0]];

  const textLen = (arr: TPineconeTranscriptSegment[]) => arr.map(x => x.text).join(" ").length;
  const gap = (a: TPineconeTranscriptSegment, b: TPineconeTranscriptSegment) =>
    (b.start - (a.start + a.duration));

  for (let i = 1; i < segs.length; i++) {
    const prev = bucket[bucket.length - 1];
    const curr = segs[i];
    const shouldMerge = gap(prev, curr) <= maxGapSec || textLen(bucket) < minGroupChars;
    if (shouldMerge) {
      bucket.push(curr);
    } else {
      out.push(mergeBucket(bucket));
      bucket = [curr];
    }
  }
  out.push(mergeBucket(bucket));
  return out;

  function mergeBucket(b: TPineconeTranscriptSegment[]): TPineconeTranscriptSegment {
    const start = b[0].start;
    const end = b[b.length - 1].start + b[b.length - 1].duration;
    return {
      start,
      duration: Math.max(0.2, end - start),
      text: b.map(x => x.text).join(" ").replace(/\s+/g, " ").trim(),
    };
  }
}

/**
 * Transcript를 적절한 크기의 chunk로 분할 (세그먼트/시간/겹침 일관성 유지)
 */
export function chunkTranscript(
  segments: TPineconeTranscriptSegment[],
  {
    // === 기본값 조정 (브이로그 데이터 기준) ===
    maxChars = 1000,
    overlapChars = 200,
    maxDurationSec = 120,          // ★ 90~120 권장
    minChars = 400,                // ★ 400 권장 (기존 500 → 400)

    // 확장 기본값
    minDurationSec = 30,           // ★ 20~30 권장 (기존 60 → 30)
    mergeSmallTail = true,
    cleanText = true,
    dropShortSegUnder = 3,         // ★ 2~3 권장 (기존 6 → 3)

    // 토큰 기반(있으면 우선)
    maxTokens,
    overlapTokens,
    minTokens,                     // ★ 추가
    tokenCounter,

    // 선병합 옵션
    useCoalesce = true,            // ★ 기본 사용
    coalesceMaxGapSec = 0.8,
    coalesceMinGroupChars = 40,
  }: Options = {}
): Chunk[] {
  if (!segments?.length) return [];

  // ---------- 전처리: 잡음 제거/공백 정규화 ----------
  const normalize = (t: string) => {
    let s = t ?? "";
    if (cleanText) {
      s = s
        .replace(/\[[^\]]+\]/g, "")   // [음악], [박수] 등
        .replace(/>{2,}/g, "")        // >> 기호
        .replace(/\s+/g, " ")         // 공백 정리
        .trim();
    }
    return s;
  };

  let cleaned: TPineconeTranscriptSegment[] = [];
  for (const seg of segments) {
    const text = normalize(seg.text ?? "");
    if (text.length >= dropShortSegUnder) {
      cleaned.push({ ...seg, text });
    }
  }
  if (!cleaned.length) return [];

  // ---------- (선택) 마이크로 세그먼트 선병합 ----------
  if (useCoalesce) {
    cleaned = coalesceSmallSegments(cleaned, coalesceMaxGapSec, coalesceMinGroupChars);
  }

  // ---------- 길이 측정자: 토큰 우선, 없으면 문자 ----------
  const useTokens = !!(tokenCounter && (maxTokens || overlapTokens || minTokens));
  const lengthOf = (t: string) => (useTokens ? tokenCounter!(t) : t.length);

  // ★ 단위 일치: budgets를 토큰/문자 기준으로 각각 설정
  const maxBudget = useTokens ? (maxTokens ?? 900) : maxChars;
  const overlapBudget = Math.min(
    useTokens ? (overlapTokens ?? 180) : overlapChars,
    maxBudget
  );
  const minBudget = useTokens
    ? (minTokens ?? Math.round(minChars / 4))  // 대략적으로 1 token ≈ 3~4 chars 가정
    : (minChars);

  // ---------- 헬퍼 ----------
  const chunks: Chunk[] = [];
  let bucket: TPineconeTranscriptSegment[] = [];
  let bucketLen = 0; // lengthOf 합(공백 포함)

  const segLen = (s: TPineconeTranscriptSegment) => lengthOf((s.text ?? "") + " ");

  const pushChunk = (segs: TPineconeTranscriptSegment[]) => {
    if (!segs.length) return;
    const text = segs.map(s => s.text ?? "").join(" ").trim();
    if (!text) return;
    const startTime = segs[0].start ?? 0;
    const last = segs[segs.length - 1];
    const endTime = (last.start ?? 0) + (last.duration ?? 0);
    chunks.push({ text, startTime, endTime });
  };

  const takeOverlapTail = (
    segs: TPineconeTranscriptSegment[],
    needBudget: number
  ) => {
    // 뒤에서부터 필요 예산만큼 세그먼트를 겹침으로
    const out: TPineconeTranscriptSegment[] = [];
    let acc = 0;
    for (let i = segs.length - 1; i >= 0; i--) {
      const t = (segs[i].text ?? "") + " ";
      out.unshift(segs[i]);
      acc += lengthOf(t);
      if (acc >= needBudget) break;
    }
    return out;
  };

  const fitsTimeMax = (segs: TPineconeTranscriptSegment[]) => {
    if (!maxDurationSec) return true;
    const start = segs[0].start ?? 0;
    const last = segs[segs.length - 1];
    const end = (last.start ?? 0) + (last.duration ?? 0);
    return end - start <= maxDurationSec;
  };

  // ---------- 메인 루프 ----------
  for (const seg of cleaned) {
    const sLen = segLen(seg);

    // 후보 버킷
    const candidate = bucket.concat(seg);
    const candidateLen = bucketLen + sLen;

    const overBudget = candidateLen > maxBudget || !fitsTimeMax(candidate);

    if (bucket.length > 0 && overBudget && bucketLen >= Math.max(minBudget, 1)) { // ★ minBudget 사용
      // 1) 현재 버킷 확정
      pushChunk(bucket);

      // 2) 겹침(세그먼트 단위)
      const need = Math.min(overlapBudget, bucketLen);
      const overlapSegs = takeOverlapTail(bucket, need);

      // 3) 새 버킷 = 겹침 + 현재 세그먼트
      bucket = overlapSegs.concat(seg);
      bucketLen = overlapSegs.reduce((a, s) => a + segLen(s), 0) + sLen;
    } else {
      // 아직 예산 내이거나(혹은 min 하한 미달) 계속 누적
      bucket.push(seg);
      bucketLen = candidateLen;
    }
  }

  // 마지막 버킷 flush
  if (bucket.length) pushChunk(bucket);

  // ---------- 꼬리 청크가 너무 짧으면 병합(선택) ----------
  if (mergeSmallTail && chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    const lastLen = lengthOf(last.text);
    if (lastLen < Math.max(Math.round(minBudget * 0.6), 1)) { // ★ minBudget 기준
      const merged: Chunk = {
        text: (prev.text + " " + last.text).replace(/\s+/g, " ").trim(),
        startTime: prev.startTime,
        endTime: last.endTime,
      };
      chunks.splice(chunks.length - 2, 2, merged);
    }
  }

  // ---------- 최소 시간 하한 충족 안 되는 청크 보정(선택) ----------
  if (minDurationSec && chunks.length >= 2) {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const dur = c.endTime - c.startTime;
      if (dur < minDurationSec) {
        if (i > 0) {
          const prev = chunks[i - 1];
          chunks[i - 1] = {
            text: (prev.text + " " + c.text).replace(/\s+/g, " ").trim(),
            startTime: prev.startTime,
            endTime: c.endTime,
          };
          chunks.splice(i, 1);
          i -= 1;
        } else if (i + 1 < chunks.length) {
          const next = chunks[i + 1];
          chunks[i] = {
            text: (c.text + " " + next.text).replace(/\s+/g, " ").trim(),
            startTime: c.startTime,
            endTime: next.endTime,
          };
          chunks.splice(i + 1, 1);
        }
      }
    }
  }

  // ---------- 빈 결과 가드(최후의 보루) ----------
  if (chunks.length === 0 && cleaned.length) { // ★
    // 전부 합쳐 1청크로라도 생성 (로그 권장)
    const start = cleaned[0].start ?? 0;
    const end = cleaned[cleaned.length - 1].start + cleaned[cleaned.length - 1].duration;
    chunks.push({
      text: cleaned.map(s => s.text).join(" ").replace(/\s+/g, " ").trim(),
      startTime: start,
      endTime: end,
    });
  }

  return chunks;
}
