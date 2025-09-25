export type TYouTubeDataAPIVideoSnippet = {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
    standard?: { url: string; width: number; height: number };
    maxres?: { url: string; width: number; height: number };
  };
  channelTitle: string;
  tags?: string[];
  categoryId: string;
  liveBroadcastContent: "none" | "live" | "upcoming";
  localized: {
    title: string;
    description: string;
  };
  defaultAudioLanguage?: string;
};

export type TYouTubeDataAPIVideoStatistics = {
  viewCount: string;
  likeCount: string;
  favoriteCount: string;
  commentCount: string;
};

export type TYouTubeDataAPIVideoItem = {
  kind: string; // "youtube#video"
  etag: string;
  id: string; // videoId
  snippet: TYouTubeDataAPIVideoSnippet;
  contentDetails: {
    duration: string; // ISO 8601
    dimension: string; // "2d" | "3d"
    definition: "sd" | "hd";
    caption: "true" | "false";
    licensedContent: boolean;
    projection: "rectangular" | "360";
  };
  status: {
    uploadStatus: string;
    privacyStatus: "public" | "unlisted" | "private";
    license: string;
    embeddable: boolean;
    publicStatsViewable: boolean;
  };
  statistics: TYouTubeDataAPIVideoStatistics;
  topicDetails?: {
    topicIds?: string[];
    relevantTopicIds?: string[];
  };
};

export type TYouTubeDataAPIVideoListResponse = {
  kind: string; // "youtube#videoListResponse"
  etag: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: TYouTubeDataAPIVideoItem[];
};
