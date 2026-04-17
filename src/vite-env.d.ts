/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_GIAPHA_FILE_ID: string
  readonly VITE_GOOGLE_CLIENT_ID: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
