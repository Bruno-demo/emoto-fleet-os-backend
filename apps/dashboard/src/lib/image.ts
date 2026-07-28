export interface CompressImageOptions {
  maxW?: number;
  maxH?: number;
  quality?: number;
  maxSizeBytes?: number; // Max input file size limit
}

/**
 * Downscales and compresses an image file client-side using canvas.
 * Validates input file size and applies document-tailored compression.
 */
export function compressImage(
  file: File,
  maxWOrOptions: number | CompressImageOptions = 800,
  maxH = 800,
  quality = 0.8,
): Promise<string> {
  const options: CompressImageOptions =
    typeof maxWOrOptions === 'number'
      ? { maxW: maxWOrOptions, maxH, quality }
      : { maxW: 800, maxH: 800, quality: 0.8, ...maxWOrOptions };

  const targetMaxW = options.maxW ?? 800;
  const targetMaxH = options.maxH ?? 800;
  const targetQuality = options.quality ?? 0.8;
  const limitBytes = options.maxSizeBytes ?? 15 * 1024 * 1024; // 15MB default

  if (file.size > limitBytes) {
    const limitMB = Math.round(limitBytes / (1024 * 1024));
    return Promise.reject(
      new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${limitMB}MB`),
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Downscale matching aspect ratio
        if (width > height) {
          if (width > targetMaxW) {
            height = Math.round((height * targetMaxW) / width);
            width = targetMaxW;
          }
        } else {
          if (height > targetMaxH) {
            width = Math.round((width * targetMaxH) / height);
            height = targetMaxH;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas 2d context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', targetQuality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Passport Photo: 1:1 Square/Portrait orientation, max 10MB input file limit.
 */
export function compressPassportPhoto(file: File): Promise<string> {
  return compressImage(file, {
    maxW: 600,
    maxH: 600,
    quality: 0.85,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
  });
}

/**
 * Driving Licence Photo: Landscape ID card orientation (1.58:1 ratio), max 15MB input limit.
 * Higher resolution & quality (0.85) to preserve legible license details.
 */
export function compressLicencePhoto(file: File): Promise<string> {
  return compressImage(file, {
    maxW: 1200,
    maxH: 760,
    quality: 0.85,
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
  });
}

/**
 * National ID Card Photo: Landscape ID card orientation (1.58:1 ratio), max 15MB input limit.
 * Higher resolution & quality (0.85) to preserve legible national ID numbers.
 */
export function compressIdentityCardPhoto(file: File): Promise<string> {
  return compressImage(file, {
    maxW: 1200,
    maxH: 760,
    quality: 0.85,
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
  });
}

