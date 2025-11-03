import groq from "../../config/groq.js";
import openaiClient from "../../config/openai-client.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { sleep } from "../../utils/sleep.js";

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

  /**
   * 전체 YouTube Video 트랜스크립트에서 메타데이터 추출
   */
  async generateMetadataFromFullTranscript(
    videoId: string,
    videoTitle: string,
    fullTranscriptText: string,
    language: string,
  ): Promise<TAnalyzedContentMetadata> {
    // 텍스트가 너무 길면 처음 8000자만 사용 (토큰 제한)
    const truncatedText =
      fullTranscriptText.length > 8000
        ? fullTranscriptText.substring(0, 8000) + "..."
        : fullTranscriptText;

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
      info_travel_tips: [],
      language: language || "ko", // 파라미터로 받은 language 사용
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

  /**
   * Get System Prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert at analyzing YouTube video transcripts about Korean travel, food, and lifestyle content.
  
  Your task is to extract comprehensive structured metadata from the transcript.
  
  Respond ONLY in valid JSON format with ALL fields below:
  
  {
    "info_country": ["대한민국", "미국"],
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
    "info_reservation_required": false,
    "info_travel_tips": ["주말을 피하는 게 좋아요", "대중교통을 이용해 주세요"],
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
  
  **info_reservation_required** (예약 필수 - boolean):
  - true if reservation/booking is mentioned as required or recommended
  - false otherwise
  
  **info_travel_tips** (여행 팁 - 한국어 문장, max 5):
  - Short, actionable tips in natural Korean sentences
  - Must be complete sentences ending with 요/에요/습니다
  - Examples: "주말을 피하는 게 좋아요", "미리 예약하는 것을 추천해요", 
    "일찍 도착하는 게 좋아요", "현금을 준비해 가세요", "날씨를 확인하고 가세요",
    "대중교통을 이용해 주세요", "편한 신발을 착용하세요", "한복을 입으면 무료 입장이에요"
  - Extract tips directly from the video transcript or infer practical advice
  - Write in a friendly, conversational tone
  
  **language** (언어 코드):
  - Primary language of the video: "ko", "en", "ja", "zh", "es", etc.
  
  **sentimentScore** (감정 점수 - 0.0 to 1.0):
  - Overall sentiment/positivity of the video
  - 0.0-0.3: Negative, 0.3-0.7: Neutral, 0.7-1.0: Positive
  
  **mainTopic** (핵심 주제 - ENGLISH):
  - One sentence summarizing the main topic
  - Example: "Budget Travel Tips in Seoul", "Best Cafes in Gangnam"
  
  **confidence_score** (신뢰도 - 0.0 to 1.0):
  - Overall confidence in the extracted metadata
  
  **Extraction Rules:**
  1. Extract ONLY information explicitly mentioned in the transcript
  2. Use original language for location names and proper nouns
  3. Use English for categories, tags, and standardized fields
  4. Use Korean sentences for info_travel_tips (natural, conversational style)
  5. Maximum 5 items per array field (prioritize most relevant)
  6. If information is not mentioned, use empty array [] or appropriate default
  7. Be conservative - only extract what you're confident about
  8. For boolean fields, default to false if unclear`;
}

  /**
   * Build Prompt
   */
  private buildPrompt(
    videoTitle: string,
    transcriptText: string,
    language: string,
  ): string {
    return `Video Title: ${videoTitle}
Language: ${language}

Transcript:
${transcriptText}

Extract metadata from this video transcript following the system instructions.
Return valid JSON only.`;
  }
}
