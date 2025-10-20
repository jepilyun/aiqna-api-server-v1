import { TYouTubeTranscriptStandardSegment } from "aiqna_common_v1";

type TChunkYouTueVideoTranscript = {
  text: string;
  startTime: number;
  endTime: number;
};

type TChunkYouTubeVideoTranscriptOptions = {
  // === 기존 옵션(후방호환) ===
  maxChars?: number; // 청크 최대 길이(문자)
  overlapChars?: number; // 겹침 길이(문자)
  maxDurationSec?: number; // 청크 최대 길이(초)
  minChars?: number; // 너무 짧은 청크 방지 하한(문자)

  // === 확장 옵션(선택) ===
  minDurationSec?: number; // 청크 최소 길이(초)
  mergeSmallTail?: boolean; // 마지막 꼬리 청크가 너무 짧으면 이전 청크와 병합
  cleanText?: boolean; // [음악], >> 등 잡음 제거
  dropShortSegUnder?: number; // 전처리 후 이 길이 미만 세그먼트 드롭(문자)

  // 토큰 기반 예산(선택): tokenCounter 제공 시 우선 사용
  maxTokens?: number;
  overlapTokens?: number;
  minTokens?: number;
  tokenCounter?: (text: string) => number; // 예: tiktoken 등

  // 마이크로 세그먼트 선병합
  useCoalesce?: boolean;
  coalesceMaxGapSec?: number; // 인접 세그 간 최대 갭(초)
  coalesceMinGroupChars?: number; // 그룹 최소 글자 길이(문자)
};

/**
 * 내부: 마이크로 세그먼트 병합
 * 
 * 목적: 매우 짧은 세그먼트들(예: "안녕", "하세요")을 미리 합쳐서
 *       나중에 청킹할 때 너무 잘게 쪼개지지 않도록 함
 * 
 * 병합 조건:
 * 1) 이전 세그먼트와 현재 세그먼트 사이의 시간 간격이 maxGapSec 이하
 * 2) 또는 현재까지 모은 그룹의 총 글자 수가 minGroupChars 미만
 * 
 * @param segs - 세그먼트 배열
 * @param maxGapSec - 인접 세그먼트 간 최대 갭(초). 예: 0.8초
 * @param minGroupChars - 그룹 최소 글자 길이(문자). 예: 40자
 * @returns 병합된 세그먼트 배열
 */
function coalesceSmallSegments(
  segs: TYouTubeTranscriptStandardSegment[],
  maxGapSec: number,
  minGroupChars: number,
): TYouTubeTranscriptStandardSegment[] {
  if (!segs.length) return segs;
  
  const out: TYouTubeTranscriptStandardSegment[] = [];
  let bucket: TYouTubeTranscriptStandardSegment[] = [segs[0]]; // 현재 병합 중인 그룹

  // 헬퍼 함수: 세그먼트 배열의 총 텍스트 길이 계산
  const textLen = (arr: TYouTubeTranscriptStandardSegment[]) =>
    arr.map((x) => x.text).join(" ").length;
  
  // 헬퍼 함수: 두 세그먼트 사이의 시간 간격 계산
  const gap = (
    a: TYouTubeTranscriptStandardSegment,
    b: TYouTubeTranscriptStandardSegment,
  ) => b.start - (a.start + a.duration);

  // 두 번째 세그먼트부터 순회하면서 병합 여부 결정
  for (let i = 1; i < segs.length; i++) {
    const prev = bucket[bucket.length - 1]; // 현재 그룹의 마지막 세그먼트
    const curr = segs[i]; // 처리 중인 세그먼트
    
    // 병합 조건: 시간 간격이 짧거나 OR 그룹이 아직 작으면
    const shouldMerge =
      gap(prev, curr) <= maxGapSec || textLen(bucket) < minGroupChars;
    
    if (shouldMerge) {
      bucket.push(curr); // 현재 그룹에 추가
    } else {
      out.push(mergeBucket(bucket)); // 현재 그룹을 하나의 세그먼트로 병합하여 출력
      bucket = [curr]; // 새 그룹 시작
    }
  }
  out.push(mergeBucket(bucket)); // 마지막 그룹 처리
  return out;

  // 헬퍼 함수: 세그먼트 배열을 하나의 세그먼트로 병합
  function mergeBucket(
    b: TYouTubeTranscriptStandardSegment[],
  ): TYouTubeTranscriptStandardSegment {
    const start = b[0].start; // 그룹의 시작 시간 = 첫 세그먼트의 시작
    const end = b[b.length - 1].start + b[b.length - 1].duration; // 그룹의 끝 시간
    return {
      start,
      duration: Math.max(0.2, end - start), // 최소 0.2초 보장
      text: b
        .map((x) => x.text)
        .join(" ")
        .replace(/\s+/g, " ") // 연속된 공백을 하나로
        .trim(),
    };
  }
}

/**
 * YouTube Transcript를 적절한 크기의 chunk로 분할
 * 
 * 전체 흐름:
 * 1) 인코딩 검증
 * 2) 텍스트 전처리 (잡음 제거, 짧은 세그먼트 제거)
 * 3) 마이크로 세그먼트 선병합 (useCoalesce=true인 경우)
 * 4) 병합 후 너무 긴 세그먼트는 문장 단위로 재분할
 * 5) 메인 청킹 로직 (예산 기반으로 청크 생성)
 * 6) 후처리 (꼬리 청크 병합, 시간 하한 보정)
 * 7) 최종 검증
 * 
 * @param segments - 세그먼트 배열
 * @param options - 옵션
 * @returns 분할된 청크 배열
 */
export function chunkYouTubeVideoTranscript(
  segments: TYouTubeTranscriptStandardSegment[],
  {
    // === 기본값 조정 (브이로그 데이터 기준) ===
    maxChars = 800, // 청크 최대 800자
    overlapChars = 150, // 청크 간 150자 겹침
    minChars = 400, // 청크 최소 400자
    maxDurationSec = 120, // 청크 최대 120초

    // 확장 기본값
    minDurationSec = 30, // 청크 최소 30초
    mergeSmallTail = true, // 마지막 작은 청크는 병합
    cleanText = true, // 잡음 제거 활성화
    dropShortSegUnder = 3, // 3자 미만 세그먼트 제거

    // 토큰 기반(있으면 우선)
    maxTokens,
    overlapTokens,
    minTokens,
    tokenCounter,

    // 선병합 옵션
    useCoalesce = true, // 마이크로 세그먼트 선병합 활성화
    coalesceMaxGapSec = 0.8, // 0.8초 이내면 병합
    coalesceMinGroupChars = 40, // 그룹이 40자 미만이면 계속 병합
  }: TChunkYouTubeVideoTranscriptOptions = {},
): TChunkYouTueVideoTranscript[] {
  if (!segments?.length) return [];

  // ========================================
  // STEP 1: 인코딩 검증
  // ========================================
  // UTF-8 깨진 문자 패턴 검사 (예: ì, ë 등)
  const hasCorruptedEncoding = segments.some(seg => 
    /[ì|ë|ê|ìŠ|ì—|í]/.test(seg.text || '')
  );
  if (hasCorruptedEncoding) {
    console.error('❌ Corrupted encoding detected in segments');
    throw new Error('Invalid transcript encoding - please re-fetch transcripts');
  }

  // ========================================
  // STEP 2: 텍스트 전처리
  // ========================================
  // 잡음 제거 함수: [음악], >>, 연속 공백 제거
  const normalize = (t: string) => {
    let s = t ?? "";
    if (cleanText) {
      s = s
        .replace(/\[[^\]]+\]/g, "") // [음악], [박수] 등 제거
        .replace(/>{2,}/g, "") // >> 제거
        .replace(/\s+/g, " ") // 연속 공백을 하나로
        .trim();
    }
    return s;
  };

  // 정규화하고 너무 짧은 세그먼트는 제거
  let cleaned: TYouTubeTranscriptStandardSegment[] = [];
  for (const seg of segments) {
    const text = normalize(seg.text ?? "");
    if (text.length >= dropShortSegUnder) { // 3자 이상만 유지
      cleaned.push({ ...seg, text });
    }
  }
  if (!cleaned.length) return [];

  // ========================================
  // STEP 3: 마이크로 세그먼트 선병합
  // ========================================
  if (useCoalesce) {
    // 짧은 세그먼트들을 미리 합침
    // 예: ["안녕", "하세요", "저는"] → ["안녕 하세요 저는"]
    cleaned = coalesceSmallSegments(
      cleaned,
      coalesceMaxGapSec, // 0.8초 이내 간격이면 병합
      coalesceMinGroupChars, // 40자 미만이면 계속 병합
    );

    // ========================================
    // STEP 4: 병합 후 너무 긴 세그먼트는 재분할
    // ========================================
    // 선병합으로 인해 너무 긴 세그먼트가 생성될 수 있음
    // 예: 1000자짜리 세그먼트 → 400자씩 2~3개로 분할
    const splitCleaned: TYouTubeTranscriptStandardSegment[] = [];
    
    for (const seg of cleaned) {
      const text = seg.text ?? "";
      
      // maxChars의 50%(=400자) 초과 시 분할
      // 이유: 청킹 시 2개가 합쳐져도 800자를 넘지 않도록
      if (text.length > maxChars * 0.5) {
        
        // 문장 경계로 분할 (마침표, 느낌표, 물음표 + 공백)
        const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim());
        const targetSize = maxChars * 0.4; // 320자 목표 (400자보다 약간 작게)

        let currentText = ""; // 현재 누적 중인 텍스트
        const tempSegments: string[] = []; // 분할된 텍스트들
        
        // 문장을 하나씩 추가하면서 targetSize에 도달하면 분할
        for (const sentence of sentences) {
          // 현재 텍스트 + 새 문장이 목표 크기를 초과하고, 현재 텍스트가 비어있지 않으면
          if (currentText.length + sentence.length > targetSize && currentText) {
            tempSegments.push(currentText.trim()); // 현재까지 누적된 텍스트 저장
            currentText = sentence; // 새 문장으로 시작
          } else {
            // 아직 목표 크기 이하면 계속 누적
            currentText += (currentText ? " " : "") + sentence;
          }
        }
        // 마지막 남은 텍스트 저장
        if (currentText.trim()) {
          tempSegments.push(currentText.trim());
        }

        // ========================================
        // 시간 정보를 비율로 분배
        // ========================================
        // 예: 원래 세그먼트가 10초였고 3개로 분할되면
        //     각각 3.33초씩 할당
        const actualCount = tempSegments.length;
        if (actualCount > 0) {
          const durationPerSeg = seg.duration / actualCount; // 각 조각의 시간
          
          for (let idx = 0; idx < tempSegments.length; idx++) {
            splitCleaned.push({
              start: seg.start + (idx * durationPerSeg), // 시작 시간 = 원래 시작 + (인덱스 * 조각 시간)
              duration: durationPerSeg, // 조각 시간
              text: tempSegments[idx],
            });
          }
        }
      } else {
        // 400자 이하면 그대로 유지
        splitCleaned.push(seg);
      }
    }
    cleaned = splitCleaned;
  }

  // ========================================
  // STEP 5: 예산 설정 (토큰 vs 문자)
  // ========================================
  // tokenCounter가 제공되고 토큰 관련 옵션이 있으면 토큰 기준 사용
  const useTokens = !!(
    tokenCounter &&
    (maxTokens || overlapTokens || minTokens)
  );
  
  // 길이 측정 함수: 토큰 또는 문자
  const lengthOf = (t: string) => (useTokens ? tokenCounter!(t) : t.length);

  // 예산(budget) 설정
  const maxBudget = useTokens ? (maxTokens ?? 900) : maxChars; // 최대 예산: 900토큰 or 800자
  const overlapBudget = Math.min(
    useTokens ? (overlapTokens ?? 180) : overlapChars, // 겹침 예산: 180토큰 or 150자
    maxBudget,
  );
  const minBudget = useTokens
    ? (minTokens ?? Math.round(minChars / 4)) // 토큰: 대략 100토큰
    : minChars; // 문자: 400자

  // ========================================
  // STEP 6: 메인 청킹 로직
  // ========================================
  const chunks: TChunkYouTueVideoTranscript[] = []; // 최종 청크 배열
  let bucket: TYouTubeTranscriptStandardSegment[] = []; // 현재 청크에 들어갈 세그먼트들
  let bucketLen = 0; // 현재 버킷의 총 길이 (공백 포함)

  // 세그먼트 길이 계산 (공백 포함)
  const segLen = (s: TYouTubeTranscriptStandardSegment) =>
    lengthOf((s.text ?? "") + " ");

  // 청크 생성 함수: 세그먼트 배열을 하나의 청크로 변환
  const pushChunk = (segs: TYouTubeTranscriptStandardSegment[]) => {
    if (!segs.length) return;
    
    // 모든 세그먼트의 텍스트를 공백으로 연결
    const text = segs
      .map((s) => s.text ?? "")
      .join(" ")
      .trim();
    if (!text) return;
    
    // 시작 시간 = 첫 세그먼트의 시작
    const startTime = segs[0].start ?? 0;
    // 끝 시간 = 마지막 세그먼트의 끝
    const last = segs[segs.length - 1];
    const endTime = (last.start ?? 0) + (last.duration ?? 0);
    
    chunks.push({ text, startTime, endTime });
  };

  // 겹침용 세그먼트 추출: 버킷의 뒤쪽에서 needBudget만큼 가져옴
  const takeOverlapTail = (
    segs: TYouTubeTranscriptStandardSegment[],
    needBudget: number, // 필요한 겹침 길이 (예: 150자)
  ) => {
    const out: TYouTubeTranscriptStandardSegment[] = [];
    let acc = 0; // 누적 길이
    
    // 뒤에서부터 역순으로 순회
    for (let i = segs.length - 1; i >= 0; i--) {
      const t = (segs[i].text ?? "") + " ";
      out.unshift(segs[i]); // 앞에 추가 (역순이므로)
      acc += lengthOf(t);
      if (acc >= needBudget) break; // 필요한 만큼 모았으면 중단
    }
    return out;
  };

  // 시간 제약 검사: 세그먼트들의 총 시간이 maxDurationSec 이하인지
  const fitsTimeMax = (segs: TYouTubeTranscriptStandardSegment[]) => {
    if (!maxDurationSec) return true; // 시간 제약 없으면 항상 true
    const start = segs[0].start ?? 0;
    const last = segs[segs.length - 1];
    const end = (last.start ?? 0) + (last.duration ?? 0);
    return end - start <= maxDurationSec; // 120초 이하인지
  };

  // ========================================
  // 메인 루프: 각 세그먼트를 순회하며 청크 생성
  // ========================================
  for (const seg of cleaned) {
    const sLen = segLen(seg); // 현재 세그먼트의 길이

    // 현재 세그먼트를 버킷에 추가했을 때의 후보
    const candidate = bucket.concat(seg);
    const candidateLen = bucketLen + sLen;

    // 예산 초과 여부 확인
    // 1) 길이가 maxBudget(800자) 초과
    // 2) 또는 시간이 maxDurationSec(120초) 초과
    const overBudget = candidateLen > maxBudget || !fitsTimeMax(candidate);

    // 예산 초과이고, 현재 버킷이 비어있지 않고, 최소 예산(400자) 이상이면
    if (
      bucket.length > 0 &&
      overBudget &&
      bucketLen >= Math.max(minBudget, 1)
    ) {
      // ========================================
      // 청크 확정 및 겹침 처리
      // ========================================
      
      // 1) 현재 버킷을 청크로 확정
      pushChunk(bucket);

      // 2) 겹침(overlap) 생성
      //    다음 청크의 시작 부분에 이전 청크의 끝 부분을 포함
      //    예: 이전 청크 "... 오늘 날씨가 좋습니다"
      //        다음 청크 "오늘 날씨가 좋습니다. 산책을 갔어요 ..."
      const need = Math.min(overlapBudget, bucketLen); // 150자 또는 현재 버킷 길이 중 작은 값
      const overlapSegs = takeOverlapTail(bucket, need); // 뒤에서 150자치 가져옴

      // 3) 새 버킷 = 겹침 + 현재 세그먼트
      bucket = overlapSegs.concat(seg);
      bucketLen = overlapSegs.reduce((a, s) => a + segLen(s), 0) + sLen;
    } else {
      // 아직 예산 내이거나 최소 하한 미달이면 계속 누적
      bucket.push(seg);
      bucketLen = candidateLen;
    }
  }

  // 마지막 남은 버킷을 청크로 추가
  if (bucket.length) pushChunk(bucket);

  // ========================================
  // STEP 7: 후처리 - 꼬리 청크 병합
  // ========================================
  // 마지막 청크가 너무 짧으면 이전 청크와 병합
  // 예: [..., "긴 청크 800자", "짧은 꼬리 100자"] → [..., "긴+짧은 청크 900자"]
  if (mergeSmallTail && chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    const lastLen = lengthOf(last.text);
    
    // 마지막 청크가 minBudget(400자)의 60%(=240자) 미만이면
    if (lastLen < Math.max(Math.round(minBudget * 0.6), 1)) {
      const merged: TChunkYouTueVideoTranscript = {
        text: (prev.text + " " + last.text).replace(/\s+/g, " ").trim(),
        startTime: prev.startTime,
        endTime: last.endTime,
      };
      // 마지막 두 청크를 제거하고 병합된 청크로 대체
      chunks.splice(chunks.length - 2, 2, merged);
    }
  }

  // ========================================
  // STEP 8: 후처리 - 시간 하한 보정
  // ========================================
  // 청크의 시간이 minDurationSec(30초) 미만이면 인접 청크와 병합
  if (minDurationSec && chunks.length >= 2) {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const dur = c.endTime - c.startTime; // 청크의 시간 길이
      
      if (dur < minDurationSec) {
        // 이전 청크가 있으면 이전 청크와 병합
        if (i > 0) {
          const prev = chunks[i - 1];
          chunks[i - 1] = {
            text: (prev.text + " " + c.text).replace(/\s+/g, " ").trim(),
            startTime: prev.startTime,
            endTime: c.endTime,
          };
          chunks.splice(i, 1); // 현재 청크 제거
          i -= 1; // 인덱스 조정
        } 
        // 다음 청크가 있으면 다음 청크와 병합
        else if (i + 1 < chunks.length) {
          const next = chunks[i + 1];
          chunks[i] = {
            text: (c.text + " " + next.text).replace(/\s+/g, " ").trim(),
            startTime: c.startTime,
            endTime: next.endTime,
          };
          chunks.splice(i + 1, 1); // 다음 청크 제거
        }
      }
    }
  }

  // ========================================
  // STEP 9: 최후의 보루 - 빈 결과 방지
  // ========================================
  // 모든 처리 후에도 청크가 하나도 없으면 전체를 하나의 청크로
  if (chunks.length === 0 && cleaned.length) {
    const start = cleaned[0].start ?? 0;
    const end =
      cleaned[cleaned.length - 1].start + cleaned[cleaned.length - 1].duration;
    chunks.push({
      text: cleaned
        .map((s) => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      startTime: start,
      endTime: end,
    });
  }

  // ========================================
  // STEP 10: 최종 검증 (여기에 추가!)
  // ========================================
  // 최대 예산의 1.5배(1200자)를 초과하는 청크가 있으면 경고
  if (chunks.some(chunk => lengthOf(chunk.text) > maxBudget * 1.5)) {
    console.warn('⚠️ Some chunks exceed 1.5x maxBudget - consider lowering coalesceMinGroupChars');
    // 디버깅을 위해 초과한 청크 정보 출력
    chunks.forEach((chunk, idx) => {
      const len = lengthOf(chunk.text);
      if (len > maxBudget * 1.5) {
        console.warn(`  - Chunk ${idx}: ${len} ${useTokens ? 'tokens' : 'chars'} (${chunk.startTime.toFixed(1)}s - ${chunk.endTime.toFixed(1)}s)`);
      }
    });
  }

  return chunks;
}