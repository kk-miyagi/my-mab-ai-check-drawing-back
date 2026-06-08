import { useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';

type PdfCheckResult = {
  valid: boolean;
  pageCount?: number;
  error?: string;
  offendingFiles?: string[];
};

export const usePdfValidator = () => {
  const isSinglePagePdfFile = useCallback(async (file: File): Promise<PdfCheckResult> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pageCount = typeof pdf.getPageCount === 'function' ? pdf.getPageCount() : pdf.getPages().length;
      return { valid: pageCount <= 1, pageCount };
    } catch (e) {
      return { valid: false, error: 'PDFの読み込み中にエラーが発生しました。' };
    }
  }, []);

  const allSinglePageFromFiles = useCallback(async (files: File[]): Promise<string[]> => {
    const offenders: string[] = [];
    for (const f of files) {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) continue;
      const res = await isSinglePagePdfFile(f);
      if (!res.valid) {
        offenders.push(f.name);
      }
    }
    return offenders;
  }, [isSinglePagePdfFile]);

  return {
    isSinglePagePdfFile,
    allSinglePageFromFiles,
  };
};

export default usePdfValidator;