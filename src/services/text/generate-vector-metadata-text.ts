import {
  TPineconeVectorMetadataForContent,
  TSqlTextDetail,
} from "aiqna_common_v1";

/**
 * generateVectorMetadataText
 * TSqlTextDetail을 TPineconeVectorMetadataForContent으로 변환
 * @param textData TSqlTextDetail
 * @returns
 */
export function generateVectorMetadataText(
  textData: TSqlTextDetail,
): Partial<TPineconeVectorMetadataForContent> {
  return {
    title: textData.title ?? undefined, // Title
    content: textData.content, // Content
  };
}
