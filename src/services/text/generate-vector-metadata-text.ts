import {
  IPineconeVectorMetadataForText,
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
): Partial<IPineconeVectorMetadataForText> {
  return {
    title: textData.title ?? undefined, // Title
    text: textData.content, // Content
  };
}
