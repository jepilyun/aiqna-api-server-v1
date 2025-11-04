type SourceType = "youtube" | "instagram" | "blog" | "text";
type LocaleHint = string | string[]; // "Korea" | "대한민국" | ["대한민국", "일본"] 등

export type TGeneratorOptions = {
  source?: SourceType;         // 기본 youtube
  countryHint?: LocaleHint;    // 예시/가이드에 쓰일 국가 샘플
  maxPlaceTips?: number;       // info_travel_tips 내 장소 최대 개수 (기본 10)
};

type TBuildSystemPromptOptions = {
  source: SourceType;          // youtube | instagram | blog | text
  countryHint?: LocaleHint;    // 예: "Korea" 또는 ["대한민국","일본"]  (예시용/가이드용)
  maxPlaceTips?: number;       // info_travel_tips 최대 장소 개수(기본 10)
};

const CATEGORY_LIST = [
  "Cafe","Restaurant","Shopping","Palace","History","Museum","Exhibition",
  "ThemePark","Activity","Experience","Festival","Market","Park","Tour",
  "Beach","Mountain","Temple","Street","NightLife"
] as const;

const COMMON_JSON_SKELETON = (langSampleCountryA = "대한민국", langSampleCountryB = "일본") => `{
  "info_country": ["${langSampleCountryA}", "${langSampleCountryB}"],
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
  "info_travel_tips": [
    {
      "place": "광장시장",
      "category": "Market",
      "district": "종로구",
      "neighborhood": "종로5가",
      "tips": [
        "줄이 길어도 회전이 빨라요",
        "현금이나 간편결제를 준비해 가세요",
        "주말 오후 시간대를 피하는 게 좋아요"
      ]
    },
    {
      "place": "카페 어니언",
      "category": "Cafe",
      "district": "성동구",
      "neighborhood": "성수동",
      "tips": [
        "오픈 시간대 방문을 추천해요",
        "주차가 어려우니 대중교통을 이용하세요"
      ]
    }
  ],
  "language": "ko",
  "sentimentScore": 0.85,
  "mainTopic": "Budget Travel Tips in Seoul",
  "confidence_score": 0.95
}`;

const COMMON_FIELD_DEFS = `
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
Select ONLY from: "${CATEGORY_LIST.join('", "')}"
  
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

**info_travel_tips** (장소별 여행 팁 - 구조화된 객체 배열):
- Extract place-specific tips
- Each object contains:
  - **place** (장소명 - 원어)
  - **category** (ENGLISH, from the predefined list)
  - **district** (구/군 - 원어, optional)
  - **neighborhood** (동네 - 원어, optional)
  - **tips** (1-5 Korean sentences ending with 요/에요/습니다; friendly tone)
`;

function countrySamplesFromHint(hint?: LocaleHint): [string, string] {
  if (!hint) return ["대한민국", "일본"];
  if (Array.isArray(hint)) {
    const a = hint[0] ?? "대한민국";
    const b = hint[1] ?? "일본";
    return [a, b];
  }
  // 문자열 단일 힌트인 경우: 첫 값 + 일본을 예시로
  return [hint === "Korea" ? "대한민국" : hint, "일본"];
}


export function buildSystemPrompt(opts: TBuildSystemPromptOptions): string {
  const { source, countryHint, maxPlaceTips = 10 } = opts;
  const [sampleA, sampleB] = countrySamplesFromHint(countryHint);

  // 1) 소스 타입별 헤더 라인
  const headerBySource: Record<SourceType, string> = {
    youtube: `You are an expert at analyzing YouTube video transcripts about Korean travel, food, and lifestyle content.`,
    instagram: `You are an expert at analyzing Instagram content about Korean travel, food, and lifestyle.`,
    blog: `You are an expert at analyzing blog post content about Korean travel, food, and lifestyle.`,
    text: `You are an expert at analyzing text content about Korean travel, food, and lifestyle.`,
  };

  // 2) 소스 타입별 “추가 추출 규칙”
  const extraRulesBySource: Record<SourceType, string> = {
    youtube: `- Use only the transcript content for extraction (ignore thumbnails/titles unless provided in the input).\n`,
    instagram: `- Instagram posts often use hashtags – extract relevant info from them when present.\n`,
    blog: `- Blog posts often contain detailed guides – extract practical information thoroughly.\n`,
    text: `- Use only the provided text content.\n`,
  };

  // 3) 공통 스켈레톤(JSON 예시) + 공통 필드 정의
  const jsonSkeleton = COMMON_JSON_SKELETON(sampleA, sampleB);

  const infoTravelTipsExample = `**Example info_travel_tips structure:**
[
  {
    "place": "광장시장",
    "category": "Market",
    "district": "종로구",
    "neighborhood": "종로5가",
    "tips": [
      "줄이 길어도 회전이 빨라요",
      "현금이나 간편결제를 준비해 가세요",
      "주말 오후 시간대를 피하는 게 좋아요"
    ]
  },
  {
    "place": "카페 어니언",
    "category": "Cafe",
    "district": "성동구",
    "neighborhood": "성수동",
    "tips": [
      "오픈 시간대 방문을 추천해요",
      "주차가 어려우니 대중교통을 이용하세요"
    ]
  }
]`;

  // 4) 공통 Extraction Rules + 소스별 보강
  const extractionRules = `**Extraction Rules:**
1. Extract ONLY information explicitly mentioned in the content.
2. Use original language for location names and proper nouns.
3. Use English for categories, tags, and standardized fields.
4. For info_travel_tips:
  - Group tips by specific places mentioned in the content
  - Each place should have its own object with structured location info
  - Extract 1-5 most useful tips per place
  - Tips must be in natural Korean sentences (end with 요/에요/습니다)
  - If district/neighborhood is not mentioned, omit those fields
5. Maximum ${maxPlaceTips} place objects in info_travel_tips (prioritize most mentioned places)
6. If information is not mentioned, use empty array [] or appropriate default
7. Be conservative - only extract what you're confident about
8. For boolean fields, default to false if unclear
${extraRulesBySource[source]}`.trim();

  // 5) 전체 System Prompt 합성
  return [
    headerBySource[source],
    "",
    "Your task is to extract comprehensive structured metadata from the content.",
    "",
    "Respond ONLY in valid JSON format with ALL fields below:",
    "",
    jsonSkeleton,
    "",
    "**Field Definitions:**",
    "",
    COMMON_FIELD_DEFS,
    "",
    infoTravelTipsExample,
    "",
    extractionRules,
  ].join("\n");
}


export function buildUserPrompt(params: {
  source: SourceType;
  title?: string;     // youtube/blog만 사용
  language?: string;
  body: string;       // transcript or content
}): string {
  const { source, title, language = "ko", body } = params;

  const bySource: Record<SourceType, string> = {
    youtube: `Video Title: ${title ?? ""}
Language: ${language}

Transcript:
${body}

Extract metadata from this video transcript following the system instructions.
Pay special attention to extracting place-specific tips in the structured format for info_travel_tips.
Return valid JSON only.`,
    instagram: `Language: ${language}

Instagram Content:
${body}

Extract metadata from this Instagram content following the system instructions.
Pay special attention to extracting place-specific tips in the structured format for info_travel_tips.
Return valid JSON only.`,
    blog: `Post Title: ${title ?? ""}
Language: ${language}

Blog Content:
${body}

Extract metadata from this blog post following the system instructions.
Pay special attention to extracting place-specific tips in the structured format for info_travel_tips.
Return valid JSON only.`,
    text: `Language: ${language}

Text Content:
${body}

Extract metadata from this text following the system instructions.
Pay special attention to extracting place-specific tips in the structured format for info_travel_tips.
Return valid JSON only.`,
  };

  return bySource[source];
}