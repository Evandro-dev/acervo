export type ExtractedArticlePdfMetadata = {
  title?: string;
  authors: string[];
  emails: string[];
  abstract?: string;
  pageCount: number;
  warnings: string[];
};

export type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
};

export type ExtractedLine = {
  page: number;
  y: number;
  text: string;
};

export type TitleSelection = {
  lines: ExtractedLine[];
  endIndex: number;
};
