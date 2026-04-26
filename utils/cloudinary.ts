import { API_BASE_URL } from "@/config/api";

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

interface CloudinaryUploadFileOptions {
  folder?: string;
  mimeType?: string;
  fileName?: string;
}

// Cache for cloudinary config
let cachedCloudinaryConfig: CloudinaryConfigMetadata | null = null;
let configFetchPromise: Promise<CloudinaryConfigMetadata> | null = null;

/**
 * Fetch Cloudinary config from public config API
 */
export const fetchCloudinaryConfigFromApi = async (): Promise<CloudinaryConfigMetadata> => {
  // Return cached config if available
  if (cachedCloudinaryConfig) {
    return cachedCloudinaryConfig;
  }

  // If already fetching, wait for the existing promise
  if (configFetchPromise) {
    return configFetchPromise;
  }

  // Start fetching
  configFetchPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/config/env`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
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
          folder: cloudinaryEnv.VITE_CLOUDINARY_FOLDER || "",
        };

        if (!metadata.cloudName || !metadata.uploadPreset) {
          throw new Error(
            "Invalid Cloudinary config: missing cloudName or uploadPreset",
          );
        }

        cachedCloudinaryConfig = metadata;
        return metadata;
      }

      throw new Error("Failed to fetch Cloudinary config from system config");
    } catch (error) {
      console.error("[Cloudinary] Error fetching config from API:", error);
      throw error;
    } finally {
      configFetchPromise = null;
    }
  })();

  return configFetchPromise;
};

/**
 * Upload image to Cloudinary from mobile app
 * @param imageUri - Local URI of the image (from expo-image-picker)
 * @param options - Upload options
 */
export const uploadImageToCloudinary = async (
  imageUri: string,
  options?: { folder?: string },
): Promise<CloudinaryUploadResult> => {
  return uploadFileToCloudinary(imageUri, options);
};

export const uploadFileToCloudinary = async (
  fileUri: string,
  options?: CloudinaryUploadFileOptions,
): Promise<CloudinaryUploadResult> => {
  try {
    // Fetch config from API if not cached
    const config = await fetchCloudinaryConfigFromApi();
    const { cloudName, uploadPreset, folder } = config;

    // Create FormData
    const formData = new FormData();

    const fileExtension = fileUri.split(".").pop()?.toLowerCase() || "jpg";
    const inferredMimeType =
      fileExtension === "png"
        ? "image/png"
        : fileExtension === "gif"
          ? "image/gif"
          : fileExtension === "webp"
            ? "image/webp"
            : fileExtension === "pdf"
              ? "application/pdf"
              : "image/jpeg";
    const mimeType = options?.mimeType || inferredMimeType;
    const isPdf = mimeType === "application/pdf" || fileExtension === "pdf";
    const resourceType = isPdf ? "raw" : "image";
    const normalizedFileName =
      options?.fileName?.trim() || `${isPdf ? "document" : "image"}.${fileExtension}`;

    // Append file
    formData.append("file", {
      uri: fileUri,
      type: mimeType,
      name: normalizedFileName,
    } as any);

    // Add upload preset
    formData.append("upload_preset", uploadPreset);

    // Add folder if specified
    const uploadFolder = options?.folder || folder;
    if (uploadFolder) {
      formData.append("folder", uploadFolder);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    // Note: Don't set Content-Type header - React Native will set it automatically with boundary
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `Upload failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    return {
      url: data.url || "",
      secureUrl: data.secure_url || data.url || "",
      publicId: data.public_id || "",
      width: data.width || 0,
      height: data.height || 0,
      bytes: data.bytes || 0,
      format: data.format || "",
    };
  } catch (error: any) {
    console.error("[Cloudinary] Upload error:", error);
    throw new Error(error?.message || "Failed to upload file to Cloudinary");
  }
};
