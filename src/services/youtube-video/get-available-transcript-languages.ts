// content/content-youtube-video/get-available-transcript-languages.ts
import { fetchYouTubeTranscriptWithRetry } from "../../utils/retry/retry-fetch-youtube.js";
import { HelperYouTube } from "../../utils/helper-youtube.js";

export type TTranscriptTrackHandle = {
  language: string;        // e.g. "en", "en-GB"
  baseUrl: string;         // captionTracks[].baseUrl
  kind?: "asr" | "manual"; // 자동 인식 vs 제작 자막
  name?: string;           // 표시 이름
};

// --- 최소 스키마 타입들(넓히기 쉬운 보수적 정의) ---
type TYouTubeRunsText = { text?: string }[];
type TYouTubeName =
  | { simpleText?: string; runs?: TYouTubeRunsText }
  | undefined;

interface IYouTubeCaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  vssId?: string;   // .ko 등으로 언어 표시가 들어있는 경우가 있음
  kind?: string;    // 'asr'가 들어오면 자동 인식 자막
  name?: TYouTubeName;
}

interface IYouTubePlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: IYouTubeCaptionTrack[];
    }
  }
}

/** 런타임 타입가드 */
function isCaptionTrack(x: unknown): x is IYouTubeCaptionTrack {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.baseUrl === "string" || typeof o.languageCode === "string" || typeof o.vssId === "string";
}

/** 안전한 JSON 파서 */
function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    try {
      const normalized = s
        .replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\n/g, "\\n");
      return JSON.parse(normalized) as T;
    } catch {
      return null;
    }
  }
}

/** runs → 문자열 결합 */
function runsToText(runs?: TYouTubeRunsText): string | undefined {
  if (!Array.isArray(runs)) return undefined;
  const joined = runs.map(r => r?.text ?? "").join("");
  return joined || undefined;
}

export async function getAvailableTranscriptLanguages(
  videoId: string,
): Promise<TTranscriptTrackHandle[]> {
  try {
    const url = HelperYouTube.buildWatchUrl(videoId);
    const response = await fetchYouTubeTranscriptWithRetry(url);
    const html = await response.text();

    // 1) ytInitialPlayerResponse 전체 JSON에서 우선 시도
    let captionTracks: IYouTubeCaptionTrack[] | null = null;

    const playerRespMatch =
      html.match(/ytInitialPlayerResponse"\]\s*=\s*(\{.*?\});/s) ||
      html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);

    if (playerRespMatch?.[1]) {
      const playerJson = safeJsonParse<IYouTubePlayerResponse>(playerRespMatch[1]);
      const tracks = playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks)) {
        captionTracks = tracks;
      }
    }

    // 2) 실패 시, captionTracks 배열만 추출 (폴백)
    if (!captionTracks) {
      const tracksMatch = html.match(/"captionTracks"\s*:\s*(\[[^\]]*\])/s);
      if (tracksMatch?.[1]) {
        const parsed = safeJsonParse<unknown>(tracksMatch[1]);
        if (Array.isArray(parsed)) {
          const filtered: IYouTubeCaptionTrack[] = parsed.filter(isCaptionTrack);
          captionTracks = filtered.length ? filtered : null;
        }
      }
    }

    if (!captionTracks || captionTracks.length === 0) {
      return [];
    }

    // 3) 핸들 매핑 (any 없이 안전 접근)
    const handles: TTranscriptTrackHandle[] = captionTracks
      .map((track): TTranscriptTrackHandle | null => {
        const baseUrl = typeof track.baseUrl === "string" ? track.baseUrl : undefined;

        // language 우선순위: languageCode → vssId 가공
        let language: string | undefined =
          typeof track.languageCode === "string" ? track.languageCode : undefined;

        if (!language && typeof track.vssId === "string") {
          // 예: ".ko" 또는 ".a.ko"
          const m = track.vssId.match(/\.([a-z]{2}(?:-[A-Za-z]{2})?)/);
          if (m?.[1]) language = m[1];
        }

        if (!baseUrl || !language) return null;

        const kind: "asr" | "manual" | undefined =
          track.kind === "asr" ? "asr" : "manual";

        const nameSimple =
          (track.name && "simpleText" in track.name && typeof track.name.simpleText === "string")
            ? track.name.simpleText
            : undefined;

        const nameRuns =
          (track.name && "runs" in track.name)
            ? runsToText(track.name.runs)
            : undefined;

        const name = nameSimple ?? nameRuns ?? undefined;

        return { language, baseUrl, kind, name };
      })
      .filter((h): h is TTranscriptTrackHandle => h !== null);

    return handles;
  } catch (error: unknown) {
    // any 금지: unknown → Error로 안전 다운캐스트
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to get available languages for ${videoId}:`, msg);
    return [];
  }
}
