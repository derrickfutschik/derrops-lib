/** Default page size for paginated API detail tab views. */
export const PAGE_SIZE = 20

// API base URL – resolved at build time
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL_OVERRIDE ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://devserver.dersza.com'
