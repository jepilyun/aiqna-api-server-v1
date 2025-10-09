import {
  TSqlInstagramPostDetail,
  TPineconeVectorMetadataForContent,
} from "aiqna_common_v1";

/**
 * convertInstagramDataToPineconeMetadata
 * TSqlInstagramPostDetail[]을 TPineconeInstagramPost[]으로 변환
 * @param instagramPost TSqlInstagramPostDetail
 * @returns
 */
export function convertInstagramDataToPineconeMetadata(
  instagramPost: TSqlInstagramPostDetail,
): Partial<TPineconeVectorMetadataForContent> {
  return {
    instagram_post_url: instagramPost.instagram_post_url, // Instagram 게시물 URL
    instagram_local_image_url: instagramPost.local_image_url ?? undefined, // Instagram 로컬 이미지 URL
    instagram_user_id: instagramPost.user_id ?? undefined, // Instagram 사용자 ID
    instagram_user_profile_url: instagramPost.user_profile_url ?? undefined, // Instagram 사용자 프로필 URL
    instagram_post_date: instagramPost.published_date ?? undefined, // Instagram 게시 날짜 (ISO 8601 형식)
  };
}
