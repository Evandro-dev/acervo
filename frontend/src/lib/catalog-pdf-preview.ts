import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type RenderCatalogPdfPreviewOptions = {
  pageNumber?: number;
  scale?: number;
  background?: string;
  imageFileName?: string;
  autoCrop?: boolean;
  cropPadding?: number;
  whiteThreshold?: number;
};

export type RenderedCatalogPdfPreview = {
  dataUrl: string;
  imageFile: File;
  blob: Blob;
  width: number;
  height: number;
  pageNumber: number;
  pageCount: number;
};

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function buildCatalogImageFileName(
  pdfFileName: string,
  imageFileName?: string,
) {
  if (imageFileName?.trim()) return imageFileName.trim();

  const baseName = pdfFileName.replace(/\.pdf$/i, "").trim();

  return `${baseName || "ficha-catalografica"}.png`;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Não foi possível gerar a imagem da ficha."));
    }, "image/png");
  });
}

function isNearWhite(
  red: number,
  green: number,
  blue: number,
  alpha: number,
  whiteThreshold: number,
) {
  if (alpha === 0) return true;

  return (
    red >= whiteThreshold &&
    green >= whiteThreshold &&
    blue >= whiteThreshold
  );
}

function findContentBounds(
  canvas: HTMLCanvasElement,
  whiteThreshold = 245,
) {
  const context = canvas.getContext("2d");
  if (!context) return null;

  const { width, height } = canvas;
  if (!width || !height) return null;

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];

      if (!isNearWhite(red, green, blue, alpha, whiteThreshold)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function cropCanvasToContent(
  sourceCanvas: HTMLCanvasElement,
  options?: {
    padding?: number;
    whiteThreshold?: number;
    background?: string;
  },
) {
  const bounds = findContentBounds(
    sourceCanvas,
    options?.whiteThreshold ?? 245,
  );

  if (!bounds) {
    return sourceCanvas;
  }

  const padding = Math.max(0, Math.trunc(options?.padding ?? 16));
  const background = options?.background ?? "#ffffff";

  const cropX = Math.max(0, bounds.minX - padding);
  const cropY = Math.max(0, bounds.minY - padding);
  const cropRight = Math.min(sourceCanvas.width - 1, bounds.maxX + padding);
  const cropBottom = Math.min(sourceCanvas.height - 1, bounds.maxY + padding);

  const croppedWidth = Math.max(1, cropRight - cropX + 1);
  const croppedHeight = Math.max(1, cropBottom - cropY + 1);

  if (
    croppedWidth === sourceCanvas.width &&
    croppedHeight === sourceCanvas.height
  ) {
    return sourceCanvas;
  }

  const targetCanvas = window.document.createElement("canvas");
  const targetContext = targetCanvas.getContext("2d", { alpha: false });

  if (!targetContext) {
    return sourceCanvas;
  }

  targetCanvas.width = croppedWidth;
  targetCanvas.height = croppedHeight;

  targetContext.save();
  targetContext.fillStyle = background;
  targetContext.fillRect(0, 0, croppedWidth, croppedHeight);
  targetContext.restore();

  targetContext.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    croppedWidth,
    croppedHeight,
    0,
    0,
    croppedWidth,
    croppedHeight,
  );

  return targetCanvas;
}

export async function renderCatalogPdfPreview(
  file: File,
  options: RenderCatalogPdfPreviewOptions = {},
): Promise<RenderedCatalogPdfPreview> {
  if (!isPdfFile(file)) {
    throw new Error("Selecione um arquivo PDF da ficha catalográfica.");
  }

  const pageNumber = Math.max(1, Math.trunc(options.pageNumber ?? 1));
  const scale = options.scale ?? 2;
  const background = options.background ?? "#ffffff";
  const autoCrop = options.autoCrop ?? true;
  const cropPadding = options.cropPadding ?? 20;
  const whiteThreshold = options.whiteThreshold ?? 245;
  const data = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data,
  });

  const pdfDocument = await loadingTask.promise;

  try {
    if (pageNumber > pdfDocument.numPages) {
      throw new Error(
        `O PDF possui apenas ${pdfDocument.numPages} página(s). Não foi possível renderizar a página ${pageNumber}.`,
      );
    }

    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d", {
      alpha: false,
    });

    if (!context) {
      throw new Error("Não foi possível criar o canvas para renderizar o PDF.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    context.save();
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();

    await page.render({
      canvasContext: context,
      viewport,
      background,
    } as unknown as Parameters<typeof page.render>[0]).promise;

    const finalCanvas = autoCrop
      ? cropCanvasToContent(canvas, {
          padding: cropPadding,
          whiteThreshold,
          background,
        })
      : canvas;

    const blob = await canvasToBlob(finalCanvas);
    const dataUrl = finalCanvas.toDataURL("image/png");
    const imageFile = new File(
      [blob],
      buildCatalogImageFileName(file.name, options.imageFileName),
      {
        type: "image/png",
      },
    );

    return {
      dataUrl,
      imageFile,
      blob,
      width: finalCanvas.width,
      height: finalCanvas.height,
      pageNumber,
      pageCount: pdfDocument.numPages,
    };
  } finally {
    await loadingTask.destroy();
  }
}