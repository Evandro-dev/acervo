export function chunkItems<T>(items: T[], chunkSize: number) {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("O tamanho do lote deve ser um inteiro positivo.");
  }

  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_, index) =>
    items.slice(index * chunkSize, (index + 1) * chunkSize),
  );
}
