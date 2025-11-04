import groq from "../../config/groq.js";
import openaiClient from "../../config/openai-client.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { sleep } from "../../utils/sleep.js";
import { buildSystemPrompt, buildUserPrompt, TGeneratorOptions } from "./build-prompt.js";

/**
 * Metadata Generator for YouTube Video
 */
export class MetadataGeneratorYouTubeVideo {
  // 사용 가능한 모델 리스트 (우선순위 순)
  private models = [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "groq", model: "llama-3.1-70b-versatile" },
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "openai", model: "gpt-4o-mini" },
  ];

  /** NEW */
  constructor(private readonly options: TGeneratorOptions = {}) {}

  /**
   * 전체 YouTube Video 트랜스크립트에서 메타데이터 추출
   */
  async generateMetadataFromText(
    videoId: string,
    videoTitle: string,
    text: string,
    language: string,
  ): Promise<TAnalyzedContentMetadata> {
    // 텍스트가 너무 길면 처음 8000자만 사용 (토큰 제한)
    const truncatedText =
      text.length > 8000
        ? text.substring(0, 8000) + "..."
        : text;

    const prompt = this.buildPrompt(videoTitle, truncatedText, language);
    const systemPrompt = this.getSystemPrompt();

    // 각 모델을 순차적으로 시도
    for (let i = 0; i < this.models.length; i++) {
      const { provider, model } = this.models[i];

      try {
        console.log(`🔄 Trying ${provider}/${model} for video ${videoId}`);

        // 재시도 로직과 함께 실행
        const result = await withRetry(
          async () => {
            if (provider === "groq") {
              return await this.analyzeWithGroq(systemPrompt, prompt, model);
            } else {
              return await this.analyzeWithOpenAI(systemPrompt, prompt, model);
            }
          },
          {
            maxRetries: 2, // 각 모델당 2회 재시도
            baseDelay: 15000, // Groq Retry-After 준수
            maxDelay: 60000,
            operationName: `Metadata extraction (${provider}/${model})`,
            shouldRetry: (error) => {
              // 503 또는 over capacity 에러만 재시도
              const errorMsg = (error as Error).message;
              return (
                errorMsg.includes("503") ||
                errorMsg.includes("over capacity") ||
                errorMsg.includes("internal_server_error")
              );
            },
          },
        );

        console.log(
          `✅ Successfully extracted metadata using ${provider}/${model}`,
        );
        return result;
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.warn(
          `⚠️ ${provider}/${model} failed for ${videoId}: ${errorMsg}`,
        );

        // 503이 아닌 다른 에러면 다음 모델로 넘어가지 않고 즉시 실패
        if (
          !errorMsg.includes("503") &&
          !errorMsg.includes("over capacity") &&
          !errorMsg.includes("internal_server_error")
        ) {
          console.error(`❌ Non-retryable error, returning empty metadata`);
          break;
        }

        // 마지막 모델이 아니면 다음 모델 시도
        if (i < this.models.length - 1) {
          console.log(`🔄 Trying next model...`);
          await sleep(2000); // 모델 전환 시 2초 대기
          continue;
        }
      }
    }

    // 모든 모델 실패 시 빈 메타데이터 반환
    console.error(
      `❌ All models failed for ${videoId}, returning empty metadata`,
    );
    return {
      info_country: [],
      info_city: [],
      info_district: [],
      info_neighborhood: [],
      info_landmark: [],
      info_category: [],
      info_name: [],
      info_special_tag: [],
      info_influencer: [],
      info_season: [],
      info_time_of_day: [],
      info_activity_type: [],
      info_target_audience: [],
      info_reservation_required: false,
      info_travel_tips: [], // ✅ 이제 객체 배열
      language: language || "ko",
      sentimentScore: 0.5,
      mainTopic: "",
      confidence_score: 0,
    };
  }

  /**
   * Groq API로 분석
   */
  private async analyzeWithGroq(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<TAnalyzedContentMetadata> {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: 0.1,
      max_tokens: 3072,
      response_format: { type: "json_object" },
    });

    return this.parseResponse(completion.choices[0].message.content);
  }

  /**
   * OpenAI API로 분석 (폴백)
   */
  private async analyzeWithOpenAI(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<TAnalyzedContentMetadata> {
    const completion = await openaiClient.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });

    return this.parseResponse(completion.choices[0].message.content);
  }

  /**
   * API 응답 파싱
   */
  private parseResponse(content: string | null | undefined): TAnalyzedContentMetadata {
    try {
      const result = JSON.parse(content || "{}");
      return {
        info_country: result.info_country || [],
        info_city: result.info_city || [],
        info_district: result.info_district || [],
        info_neighborhood: result.info_neighborhood || [],
        info_landmark: result.info_landmark || [],
        info_category: result.info_category || [],
        info_name: result.info_name || [],
        info_special_tag: result.info_special_tag || [],
        info_influencer: result.info_influencer || [],
        info_season: result.info_season || [],
        info_time_of_day: result.info_time_of_day || [],
        info_activity_type: result.info_activity_type || [],
        info_target_audience: result.info_target_audience || [],
        info_reservation_required: result.info_reservation_required || false,
        info_travel_tips: result.info_travel_tips || [],
        language: result.language || "ko",
        sentimentScore: result.sentimentScore || 0.5,
        mainTopic: result.mainTopic || "",
        confidence_score: result.confidence_score || 0.5,
      };
    } catch (error) {
      console.error("Failed to parse response:", error);
      return {
        info_country: [],
        info_city: [],
        info_district: [],
        info_neighborhood: [],
        info_landmark: [],
        info_category: [],
        info_name: [],
        info_special_tag: [],
        info_influencer: [],
        info_season: [],
        info_time_of_day: [],
        info_activity_type: [],
        info_target_audience: [],
        info_reservation_required: false,
        info_travel_tips: [],
        language: "ko",
        sentimentScore: 0.5,
        mainTopic: "",
        confidence_score: 0,
      };
    }
  }

  /** ====== 여기부터 변경 포인트 ====== */
  private getSystemPrompt(): string {
    return buildSystemPrompt({
      source: this.options.source ?? "youtube",
      countryHint: this.options.countryHint,
      maxPlaceTips: this.options.maxPlaceTips ?? 10,
    });
  }

  private buildPrompt(videoTitle: string, transcriptText: string, language: string): string {
    const source = this.options.source ?? "youtube";

    return buildUserPrompt({
      source,
      title: videoTitle,
      language,
      body: transcriptText,
    });
  }
}