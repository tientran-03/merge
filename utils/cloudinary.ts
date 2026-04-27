import { Platform } from 'react-native';

import { API_BASE_URL } from '@/config/api';
export function normalizeLocalFileUri(uri: string): string {
  if (!uri) return uri;
  const trimmed = uri.trim();
  if (trimmed.startsWith('file://')) return trimmed;
  if (Platform.OS === 'android' && trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }
  return trimmed;
}

export interface CloudinaryConfigMetadata {
  cloudName: string;
  uploadPreset: string;
  folder?: string;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}
let cachedCloudinaryConfig: CloudinaryConfigMetadata | null = null;
let configFetchPromise: Promise<CloudinaryConfigMetadata> | null = null;

export const fetchCloudinaryConfigFromApi = async (): Promise<CloudinaryConfigMetadata> => {
  if (cachedCloudinaryConfig) {
    return cachedCloudinaryConfig;
  }
  if (configFetchPromise) {
    return configFetchPromise;
  }

  configFetchPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/config/env`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const result = await response.json();

      if (result?.success && result?.data?.cloudinary) {
        const cloudinaryEnv = result.data.cloudinary;

        const metadata: CloudinaryConfigMetadata = {
          cloudName: cloudinaryEnv.VITE_CLOUDINARY_CLOUD_NAME,
          uploadPreset: cloudinaryEnv.VITE_CLOUDINARY_UPLOAD_PRESET,
          folder: cloudinaryEnv.VITE_CLOUDINARY_FOLDER || '',
        };

        if (!metadata.cloudName || !metadata.uploadPreset) {
          throw new Error('Invalid Cloudinary config: missing cloudName or uploadPreset');
        }

        cachedCloudinaryConfig = metadata;
        return metadata;
      }

      throw new Error('Failed to fetch Cloudinary config from system config');
    } catch (error) {
      console.error('[Cloudinary] Error fetching config from API:', error);
      throw error;
    } finally {
      configFetchPromise = null;
    }
  })();

  return configFetchPromise;
};

function parseCloudinaryJson(data: Record<string, unknown>): CloudinaryUploadResult {
  return {
    url: String(data.url || ''),
    secureUrl: String(data.secure_url || data.url || ''),
    publicId: String(data.public_id || ''),
    width: Number(data.width || 0),
    height: Number(data.height || 0),
    bytes: Number(data.bytes || 0),
    format: String(data.format || ''),
  };
}
function uploadImageToCloudinaryXHR(
  imageUri: string,
  uploadUrl: string,
  uploadPreset: string,
  uploadFolder?: string
): Promise<CloudinaryUploadResult> {
  const normalized = normalizeLocalFileUri(imageUri);
  const fileExtension = normalized.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType =
    fileExtension === 'png'
      ? 'image/png'
      : fileExtension === 'gif'
        ? 'image/gif'
        : fileExtension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.timeout = 120_000;
    xhr.responseType = 'text';
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const err = JSON.parse(xhr.responseText || '{}') as { error?: { message?: string } };
          reject(new Error(err.error?.message || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText || '{}') as Record<string, unknown>;
        resolve(parseCloudinaryJson(data));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Invalid Cloudinary response'));
      }
    };
    xhr.onerror = () => reject(new Error('Lỗi mạng khi tải hóa đơn lên Cloudinary'));
    xhr.ontimeout = () => reject(new Error('Hết thời gian khi tải hóa đơn lên Cloudinary'));

    const formData = new FormData();
    formData.append('file', {
      uri: normalized,
      type: mimeType,
      name: `invoice.${fileExtension}`,
    } as any);
    formData.append('upload_preset', uploadPreset);
    if (uploadFolder) {
      formData.append('folder', uploadFolder);
    }
    xhr.send(formData as any);
  });
}

function uploadFileToCloudinaryXHR(
  fileUri: string,
  uploadUrl: string,
  uploadPreset: string,
  opts?: { folder?: string; fileName?: string; mimeType?: string }
): Promise<CloudinaryUploadResult> {
  const normalized = normalizeLocalFileUri(fileUri);
  const fileName = String(opts?.fileName || '').trim();
  const mimeType = String(opts?.mimeType || '').trim();
  const nameFromUri = normalized.split('/').pop() || 'upload';
  const finalName = fileName || nameFromUri || 'upload';
  const ext = finalName.includes('.') ? finalName.split('.').pop()?.toLowerCase() : undefined;
  const fallbackMime =
    ext === 'pdf'
      ? 'application/pdf'
      : ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : 'application/octet-stream';
  const type = mimeType || fallbackMime;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.timeout = 120_000;
    xhr.responseType = 'text';
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const err = JSON.parse(xhr.responseText || '{}') as { error?: { message?: string } };
          reject(new Error(err.error?.message || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText || '{}') as Record<string, unknown>;
        resolve(parseCloudinaryJson(data));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Invalid Cloudinary response'));
      }
    };
    xhr.onerror = () => reject(new Error('Lỗi mạng khi tải file lên Cloudinary'));
    xhr.ontimeout = () => reject(new Error('Hết thời gian khi tải file lên Cloudinary'));

    const formData = new FormData();
    formData.append('file', {
      uri: normalized,
      type,
      name: finalName,
    } as any);
    formData.append('upload_preset', uploadPreset);
    const uploadFolder = opts?.folder;
    if (uploadFolder) {
      formData.append('folder', uploadFolder);
    }
    xhr.send(formData as any);
  });
}

export const uploadImageToCloudinary = async (
  imageUri: string,
  options?: { folder?: string }
): Promise<CloudinaryUploadResult> => {
  const config = await fetchCloudinaryConfigFromApi();
  const { cloudName, uploadPreset, folder } = config;
  const normalizedUri = normalizeLocalFileUri(imageUri);
  const fileExtension = normalizedUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType =
    fileExtension === 'png'
      ? 'image/png'
      : fileExtension === 'gif'
        ? 'image/gif'
        : fileExtension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

  const formData = new FormData();
  if (Platform.OS === 'web' && normalizedUri.startsWith('blob:')) {
    const blob = await fetch(normalizedUri).then((r) => r.blob());
    const ext =
      blob.type === 'image/png'
        ? 'png'
        : blob.type === 'image/webp'
          ? 'webp'
          : blob.type === 'image/gif'
            ? 'gif'
            : 'jpg';
    formData.append('file', blob, `invoice.${ext}`);
  } else {
    formData.append('file', {
      uri: normalizedUri,
      type: mimeType,
      name: `invoice.${fileExtension}`,
    } as any);
  }
  formData.append('upload_preset', uploadPreset);
  const uploadFolder = options?.folder || folder;
  if (uploadFolder) {
    formData.append('folder', uploadFolder);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.warn('[Cloudinary] fetch multipart failed (thường gặp trên Android), thử XHR:', msg);
    try {
      return await uploadImageToCloudinaryXHR(normalizedUri, uploadUrl, uploadPreset, uploadFolder);
    } catch (xhrErr) {
      console.error('[Cloudinary] XHR upload error:', xhrErr);
      throw new Error(
        xhrErr instanceof Error ? xhrErr.message : 'Không thể tải hóa đơn lên Cloudinary'
      );
    }
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(
      errorData.error?.message || `Upload failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  return parseCloudinaryJson(data);
};

/**
 * Upload generic files (PDF/images) to Cloudinary.
 * Used for invoice uploads (can be PDF) across multiple screens.
 */
export const uploadFileToCloudinary = async (
  fileUri: string,
  options?: { folder?: string; fileName?: string; mimeType?: string }
): Promise<CloudinaryUploadResult> => {
  const config = await fetchCloudinaryConfigFromApi();
  const { cloudName, uploadPreset, folder } = config;
  const normalizedUri = normalizeLocalFileUri(fileUri);
  const uploadFolder = options?.folder || folder;

  const formData = new FormData();
  if (Platform.OS === 'web' && normalizedUri.startsWith('blob:')) {
    const blob = await fetch(normalizedUri).then((r) => r.blob());
    const name = options?.fileName || `invoice.${blob.type === 'application/pdf' ? 'pdf' : 'bin'}`;
    formData.append('file', blob, name);
  } else {
    const nameFromUri = normalizedUri.split('/').pop() || 'invoice';
    formData.append('file', {
      uri: normalizedUri,
      type: options?.mimeType || 'application/octet-stream',
      name: options?.fileName || nameFromUri,
    } as any);
  }
  formData.append('upload_preset', uploadPreset);
  if (uploadFolder) {
    formData.append('folder', uploadFolder);
  }

  // Use resource_type=auto so PDF uploads work.
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  let response: Response;
  try {
    response = await fetch(uploadUrl, { method: 'POST', body: formData });
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.warn('[Cloudinary] fetch multipart failed, try XHR:', msg);
    try {
      return await uploadFileToCloudinaryXHR(normalizedUri, uploadUrl, uploadPreset, {
        folder: uploadFolder,
        fileName: options?.fileName,
        mimeType: options?.mimeType,
      });
    } catch (xhrErr) {
      console.error('[Cloudinary] XHR upload error:', xhrErr);
      throw new Error(xhrErr instanceof Error ? xhrErr.message : 'Không thể tải file lên Cloudinary');
    }
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(
      errorData.error?.message || `Upload failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  return parseCloudinaryJson(data);
};
