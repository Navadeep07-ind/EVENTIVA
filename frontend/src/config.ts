// Centralized API configuration for EVENTIVA
// In development & local network & tunnels: empty string uses the Vite proxy (/api -> http://localhost:8000)
// In cloud production: set VITE_API_BASE_URL in your hosting provider environment if hosted on separate domains

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!API_BASE_URL) return cleanEndpoint;
  return `${API_BASE_URL}${cleanEndpoint}`;
};
