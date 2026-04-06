export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL_OVERRIDE ||
  process.env.VITE_API_BASE_URL_OVERRIDE ||
  import.meta.env.VITE_API_BASE_URL ||
  process.env.VITE_API_BASE_URL
