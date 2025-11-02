import { TSqlTextDetail } from "aiqna_common_v1";
import groq from "../../config/groq.js";
import openaiClient from "../../config/openai-client.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { sleep } from "../../utils/sleep.js";

/**
 * Text Metadata Extractor with fallback support
 */
export class MetadataGeneratorText {
  // 사용 가능한 모델 리스트 (우선순위 순)
  private models = [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "groq", model: "llama-3.1-70b-versatile" },
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "openai", model: "gpt-4o-mini" },
  ];

  /**
   * Text에서 메타데이터 추출
   */
  async generateMetadataFromText(
    textData: TSqlTextDetail,
  ): Promise<TAnalyzedContentMetadata> {
    let content = "";

    if (textData.content) {
      content = textData.content.substring(0, 8000);
    }

    if (content.length === 0) {
      console.warn(`⚠️ No content available for ${textData.hash_key}`);
      return this.getEmptyMetadata();
    }

    const prompt = this.buildPrompt(content);
    const systemPrompt = this.getSystemPrompt();

    // 각 모델을 순차적으로 시도
    for (let i = 0; i < this.models.length; i++) {
      const { provider, model } = this.models[i];

      try {
        console.log(
          `🔄 Trying ${provider}/${model} for ${textData.hash_key.slice(0, 16)}...`,
        );

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
            maxRetries: 2,
            baseDelay: 15000,
            maxDelay: 60000,
            operationName: `Text metadata extraction (${provider}/${model})`,
            shouldRetry: (error) => {
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
          `⚠️ ${provider}/${model} failed for ${textData.hash_key.slice(0, 16)}...: ${errorMsg}`,
        );

        // 503이 아닌 다른 에러면 즉시 중단
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
          await sleep(2000);
          continue;
        }
      }
    }

    // 모든 모델 실패 시 빈 메타데이터 반환
    console.error(
      `❌ All models failed for ${textData.hash_key.slice(0, 16)}..., returning empty metadata`,
    );
    return this.getEmptyMetadata();
  }

  /**
   * 빈 메타데이터 반환 (중복 코드 제거)
   */
  private getEmptyMetadata(language: string = "ko"): TAnalyzedContentMetadata {
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
      reservationRequired: false,
      travelTips: [],
      language,
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
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      model,
      temperature: 0.1,
      max_tokens: 2048,
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
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
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
  private parseResponse(
    content: string | null | undefined,
  ): TAnalyzedContentMetadata {
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
        reservationRequired: result.reservationRequired || false,
        travelTips: result.travelTips || [],
        language: result.language || "ko",
        sentimentScore: result.sentimentScore || 0.5,
        mainTopic: result.mainTopic || "",
        confidence_score: result.confidence_score || 0.5,
      };
    } catch (error) {
      console.error("Failed to parse response:", error);
      return this.getEmptyMetadata();
    }
  }

  /**
   * Get System Prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert at analyzing text content about Korean travel, food, and lifestyle.

Your task is to extract comprehensive structured metadata from the text content.

Respond ONLY in valid JSON format with ALL fields below:

{
  "info_country": ["대한민국", "일본"],
  "info_city": ["서울", "부산"],
  "info_district": ["종로구", "해운대구"],
  "info_neighborhood": ["안국동", "가로수길"],
  "info_landmark": ["남산타워", "한강"],
  "info_category": ["Restaurant", "Museum"],
  "info_name": ["스타벅스", "현대백화점"],
  "info_special_tag": ["OpenRun", "LocalFood"],
  "info_influencer": ["Jennie", "BTS"],
  "info_season": ["Spring", "Winter"],
  "info_time_of_day": ["Morning", "Night"],
  "info_activity_type": ["Cycling", "Hiking"],
  "info_target_audience": ["FamilyTrip", "SoloTravel"],
  "reservationRequired": false,
  "travelTips": ["MustBookAhead", "AvoidWeekend"],
  "language": "ko",
  "sentimentScore": 0.85,
  "mainTopic": "Budget Travel Tips in Seoul",
  "confidence_score": 0.95
}

**Field Definitions:**

**info_country** (국가명 - 원어):
- Extract country names mentioned (use native language)
- Examples: "대한민국", "일본", "미국", "프랑스"

**info_city** (도시명 - 원어):
- City names mentioned
- Examples: "서울", "부산", "제주", "도쿄"

**info_district** (구/군 - 원어):
- District/borough names
- Examples: "종로구", "강남구", "해운대구"

**info_neighborhood** (동네/거리명 - 원어):
- Specific neighborhood or street names
- Examples: "안국동", "삼청동", "가로수길", "홍대"

**info_landmark** (랜드마크 - 원어):
- Famous landmarks, attractions
- Examples: "남산타워", "한강", "경복궁", "롯데월드"

**info_category** (카테고리 - ENGLISH ONLY, from predefined list):
Select ONLY from: "Cafe", "Restaurant", "Shopping", "Palace", "History", 
"Museum", "Exhibition", "ThemePark", "Activity", "Experience", "Festival", 
"Market", "Park", "Tour", "Beach", "Mountain", "Temple", "Street", "NightLife"

**info_name** (업체명/브랜드명 - 원어):
- Specific store, restaurant, or brand names
- Examples: "스타벅스", "현대백화점", "교보문고"

**info_special_tag** (특별 태그 - ENGLISH, CamelCase):
- "OpenRun" (오픈런 필요), "LocalFood" (현지 음식), "HiddenGem" (숨은 명소),
- "Instagrammable" (인스타 핫플), "BudgetFriendly" (가성비), "Luxury" (럭셔리),
- "PetFriendly" (반려동물 동반), "KidFriendly" (아이 동반), "Halal" (할랄),
- "Vegetarian" (채식), "LateNight" (심야 영업), "Seasonal" (계절 한정)

**info_influencer** (인플루언서/유명인 - 원어):
- Celebrity or influencer names mentioned
- Examples: "Jennie", "BTS", "백종원", "박나래"

**info_season** (계절 - ENGLISH):
- When to visit: "Spring", "Summer", "Fall", "Winter", "AllYear"

**info_time_of_day** (시간대 - ENGLISH):
- Best time to visit: "Morning", "Afternoon", "Evening", "Night", "Anytime"

**info_activity_type** (활동 유형 - ENGLISH, CamelCase):
- "Cycling", "Hiking", "Skiing", "Swimming", "Shopping", "Dining",
- "Photography", "Cultural", "Sightseeing", "Relaxation", "Adventure"

**info_target_audience** (타겟 - ENGLISH, CamelCase):
- "FamilyTrip", "SoloTravel", "Couples", "Friends", "Business", 
- "Students", "Seniors", "Backpackers"

**reservationRequired** (예약 필수 - boolean):
- true if reservation/booking is mentioned as required or recommended
- false otherwise

**travelTips** (여행 팁 - ENGLISH, CamelCase, max 5):
- Short, actionable tips extracted from the content
- Examples: "MustBookAhead", "AvoidWeekend", "ArriveEarly", "BringCash",
- "CheckWeather", "UsePublicTransport", "WearComfortableShoes"

**language** (언어 코드):
- Primary language of the text: "ko", "en", "ja", "zh", "es", etc.

**sentimentScore** (감정 점수 - 0.0 to 1.0):
- Overall sentiment/positivity of the content
- 0.0-0.3: Negative, 0.3-0.7: Neutral, 0.7-1.0: Positive

**mainTopic** (핵심 주제 - ENGLISH):
- One sentence summarizing the main topic
- Example: "Budget Travel Tips in Seoul", "Best Cafes in Gangnam"

**confidence_score** (신뢰도 - 0.0 to 1.0):
- Overall confidence in the extracted metadata

**Extraction Rules:**
1. Extract ONLY information explicitly mentioned in the text
2. Use original language for location names and proper nouns
3. Use English for categories, tags, and standardized fields
4. Maximum 5 items per array field (prioritize most relevant)
5. If information is not mentioned, use empty array [] or appropriate default
6. Be conservative - only extract what you're confident about
7. For boolean fields, default to false if unclear`;
  }

  /**
   * Build Prompt
   */
  private buildPrompt(content: string): string {
    return `Text Content:
${content}

Extract metadata from this text content following the system instructions.
Return valid JSON only.`;
  }
}