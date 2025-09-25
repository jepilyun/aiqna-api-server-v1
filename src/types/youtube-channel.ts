export type TYouTubeDataAPIChannelSnippet = {
  title: string;
  description: string;
  publishedAt: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
  };
  localized: {
    title: string;
    description: string;
  };
};

export type TYouTubeDataAPIChannelStatistics = {
  viewCount: string;
  subscriberCount: string;
  hiddenSubscriberCount: boolean;
  videoCount: string;
};

export type TYouTubeDataAPIChannelItem = {
  kind: string; // "youtube#channel"
  etag: string;
  id: string; // channelId
  snippet: TYouTubeDataAPIChannelSnippet;
  statistics: TYouTubeDataAPIChannelStatistics;
};

export type TYouTubeDataAPIChannelListResponse = {
  kind: string; // "youtube#channelListResponse"
  etag: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: TYouTubeDataAPIChannelItem[];
};
