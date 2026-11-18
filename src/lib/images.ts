/**
 * Converte uma foto escolhida no dispositivo em Data URL otimizada (JPEG),
 * reduzindo o tamanho para caber com folga no banco de demonstração.
 */
export async function fileToOptimizedDataUrl(file: File, maxSize = 720, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleccione un archivo de imagen (JPG, PNG o WebP).');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('La imagen supera 8 MB. Elija una foto más liviana.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('La imagen no es válida.'));
      img.src = dataUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    // Navegadores sem canvas/imagem: devolve o original para não bloquear o cadastro.
    return dataUrl;
  }
}
