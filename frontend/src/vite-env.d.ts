/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PUBLIC_COORDINATOR_REGISTRATION_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
