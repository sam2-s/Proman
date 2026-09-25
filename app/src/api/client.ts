import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web'
    ? 'http://localhost:3000'
    : 'http://192.168.1.10:3000');

export const WS_URL = API_URL.replace(/^http/, 'ws');

/** Absolute URL for a public avatar path (e.g. `/api/avatars/8`). */
export function avatarSrc(path?: string | null): string | undefined {
  return path ? `${API_URL}${path}` : undefined;
}

const TOKEN_KEY = 'proman_token';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiClientError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  async upload<T>(path: string, file: { name: string; uri: string; type?: string }): Promise<T> {
    const token = await getToken();
    const form = new FormData();
    form.append('file', {
      name: file.name,
      uri: file.uri,
      type: file.type ?? 'application/octet-stream',
    } as unknown as Blob);

    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiClientError(
        res.status,
        (data as { error?: string })?.error ?? 'Upload failed',
      );
    }
    return data as T;
  },
};
