export type TProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type TSupportedLanguage =
  | "ko"
  | "en"
  | "ja"
  | "zh-hans"
  | "zh-hant"
  | "es"
  | "fr"
  | "de";

export type TProcessingResult<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  processingTime?: number;
};
