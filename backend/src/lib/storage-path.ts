const SAFE_STORAGE_RESOURCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SAFE_STORAGE_FILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const MAX_SAFE_STORAGE_FILE_NAME_LENGTH = 240;
const MAX_STORAGE_FILE_SLUG_LENGTH = 180;

export function isSafeStorageResourceId(value: string) {
  return SAFE_STORAGE_RESOURCE_ID_PATTERN.test(value);
}

export function isSafeStorageFileName(value: string) {
  return (
    value.length <= MAX_SAFE_STORAGE_FILE_NAME_LENGTH &&
    SAFE_STORAGE_FILE_NAME_PATTERN.test(value) &&
    !value.includes("..")
  );
}

export function assertSafeStorageResourceId(value: string) {
  if (!isSafeStorageResourceId(value)) {
    throw new Error("Identificador de armazenamento invalido");
  }
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function truncateStorageFileSlug(value: string) {
  return value.slice(0, MAX_STORAGE_FILE_SLUG_LENGTH).replace(/-+$/g, "");
}
