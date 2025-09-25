export type TYouTubeDataAPISearchItem = {
  kind: string; // "youtube#searchResult"
  etag: string;
  id: {
    kind: string;
    videoId?: string;
    channelId?: string;
    playlistId?: string;
  };
  snippet: {
    publishedAt: string; // ISO 8601
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
    channelTitle: string;
    liveBroadcastContent: "none" | "live" | "upcoming";
  };
};

export type TYouTubeDataAPISearchListResponse = {
  kind: string; // "youtube#searchListResponse"
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  regionCode?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: TYouTubeDataAPISearchItem[];
};
