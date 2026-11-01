export type WechatArticleDraft = {
  title: string;
  subtitle: string;
  content: string;
  outlineTree: unknown[];
  updatedAt: string;
};

export type AnnotationRequest = {
  selectedText: string;
  annotation: string;
  articleTitle?: string;
  articleContent?: string;
  authToken?: string;
  apiUrl?: string;
};
