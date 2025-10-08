import { TPineconeVectorMetadataForContent, TSqlBlogPostDetail } from "aiqna_common_v1";

/**
 * convertInstagramDataToPineconeMetadata
 * TSqlInstagramPostDetail[]을 TPineconeInstagramPost[]으로 변환
 * @param instagramPost TSqlInstagramPostDetail
 * @returns 
 */
export function convertBlogDataToPineconeMetadata(
  blogPost: TSqlBlogPostDetail,
): Partial<TPineconeVectorMetadataForContent> {
  return {
    blog_post_url: blogPost.blog_post_url,   // Instagram 게시물 URL
    blog_title: blogPost.title,   // Blog 제목
    blog_content: blogPost.content,   // Blog 내용
    blog_image: blogPost.og_image ?? undefined,   // Blog 이미지
    blog_published_date: blogPost.published_date ?? undefined,   // Blog 게시 날짜 (ISO 8601 형식)
    blog_local_image_url: blogPost.local_image_url ?? undefined,   // Blog 로컬 이미지 URL
    blog_tags: blogPost.tags,   // Blog 태그
    blog_platform: blogPost.platform,   // Blog 플랫폼
    blog_platform_url: blogPost.platform_url,   // Blog 플랫폼 URL
  };
}

