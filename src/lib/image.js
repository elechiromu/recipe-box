// iPhoneの写真（数MB）をそのまま上げると重いので、長辺1600pxのJPEGに縮める
export async function resizeImage(file, maxSize = 1600, quality = 0.85) {
  const source = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0, w, h);
  source.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できませんでした'))), 'image/jpeg', quality)
  );
}

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* 古いSafariは下の方法で */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
