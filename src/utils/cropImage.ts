import { Area } from 'react-easy-crop';

/**
 * Memotong (slice) gambar menggunakan HTML5 Canvas berdasarkan koordinat pixel crop dari react-easy-crop,
 * kemudian mengekspornya sebagai Blob untuk kompresi lanjutan.
 */
export async function getCroppedImgBlob(
  imageSrc: string,
  pixelCrop: Area,
  targetSize = 128
): Promise<Blob> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = (err) => reject(err);
    image.crossOrigin = 'anonymous';
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Gagal menginisialisasi context canvas untuk crop gambar.');
  }

  // Aktifkan image smoothing berkualitas tinggi
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Potong bagian gambar dari koordinat pixelCrop dan skala langsung ke targetSize (128x128px)
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetSize,
    targetSize
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal membuat blob gambar hasil crop.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.9
    );
  });
}
