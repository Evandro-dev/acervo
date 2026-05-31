export function getPublicErrorMessage(error: unknown, statusCode: number) {
  if (statusCode >= 500) return "Erro interno do servidor";
  return error instanceof Error ? error.message : "Não foi possível concluir a operação";
}
