import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { importArticles, uploadArticlePdf } from "@/features/acervo/api";
import {
  useImportArticlesMutation,
  useUploadArticlePdfMutation,
} from "@/features/acervo/hooks";

vi.mock("@/features/acervo/api", () => ({
  importArticles: vi.fn(),
  uploadArticlePdf: vi.fn(),
}));

const mockedImportArticles = vi.mocked(importArticles);
const mockedUploadArticlePdf = vi.mocked(uploadArticlePdf);

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Acervo mutation invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedImportArticles.mockResolvedValue({ count: 1, items: [] });
    mockedUploadArticlePdf.mockResolvedValue({} as never);
  });

  it("keeps the default cache refresh for individual PDF uploads", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUploadArticlePdfMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() =>
      result.current.mutateAsync({
        id: "article-1",
        file: new File(["pdf"], "trabalho.pdf", { type: "application/pdf" }),
      }),
    );

    expect(invalidateQueries).toHaveBeenCalledOnce();
  });

  it("defers cache refreshes requested by the PDF batch flow", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const upload = renderHook(() => useUploadArticlePdfMutation(), {
      wrapper: createWrapper(queryClient),
    });
    const articleImport = renderHook(() => useImportArticlesMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() =>
      upload.result.current.mutateAsync({
        id: "article-1",
        file: new File(["pdf"], "trabalho.pdf", { type: "application/pdf" }),
        invalidateOnSuccess: false,
      }),
    );
    await act(() =>
      articleImport.result.current.mutateAsync({
        eventId: "event-1",
        publishImmediately: false,
        invalidateOnSuccess: false,
        items: [
          {
            title: "Trabalho",
            authors: ["Ana Silva"],
            area: "Saude",
            abstract: "",
          },
        ],
      }),
    );

    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(mockedImportArticles).toHaveBeenCalledWith({
      eventId: "event-1",
      publishImmediately: false,
      items: [
        {
          title: "Trabalho",
          authors: ["Ana Silva"],
          area: "Saude",
          abstract: "",
        },
      ],
    });
  });
});
