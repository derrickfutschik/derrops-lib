// export const VITE_API_BASE_URL = "https://dev.dersza.com"
export const API_BASE_URL =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';