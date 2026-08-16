/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEEDBACK_ENDPOINT?: string;
  readonly VITE_FEEDBACK_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const MDXContent: ComponentType;
  export default MDXContent;
}
