const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function looksLikePngBinary(data: Uint8Array) {
  if (data.byteLength < PNG_SIGNATURE.byteLength) return false;

  return PNG_SIGNATURE.every((byte, index) => data[index] === byte);
}

export function assertPngBinary(
  data: Uint8Array,
  message = "A imagem precisa ser um PNG valido.",
) {
  if (!looksLikePngBinary(data)) {
    throw new Error(message);
  }
}
