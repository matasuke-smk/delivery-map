import React, { useState, useRef, useEffect, useCallback } from 'react';

function ImageCropper({ imageUrl, onCropComplete, onCancel }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      // 初期位置を中央に設定
      const size = Math.min(img.width, img.height, 300);
      setCropArea({
        x: (img.width - size) / 2,
        y: (img.height - size) / 2,
        size: size
      });

      // スケールを計算
      const maxWidth = 400;
      const computedScale = Math.min(1, maxWidth / img.width);
      setScale(computedScale);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const drawCanvas = useCallback(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // キャンバスサイズを画像サイズに設定
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    // 画像を描画
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // 暗いオーバーレイ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 切り抜き領域をクリアして明るく表示
    const scaledCrop = {
      x: cropArea.x * scale,
      y: cropArea.y * scale,
      size: cropArea.size * scale
    };

    ctx.clearRect(scaledCrop.x, scaledCrop.y, scaledCrop.size, scaledCrop.size);
    ctx.drawImage(
      image,
      cropArea.x, cropArea.y, cropArea.size, cropArea.size,
      scaledCrop.x, scaledCrop.y, scaledCrop.size, scaledCrop.size
    );

    // 切り抜き領域の枠線
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.strokeRect(scaledCrop.x, scaledCrop.y, scaledCrop.size, scaledCrop.size);
  }, [image, cropArea, scale]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleMouseDown = (e) => {
    if (!canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    // クリックが切り抜き領域内かチェック
    if (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.size &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.size
    ) {
      setIsDragging(true);
      setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const newX = Math.max(0, Math.min(x - dragStart.x, image.width - cropArea.size));
    const newY = Math.max(0, Math.min(y - dragStart.y, image.height - cropArea.size));

    setCropArea({ ...cropArea, x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropArea.size;
    cropCanvas.height = cropArea.size;
    const ctx = cropCanvas.getContext('2d');

    ctx.drawImage(
      image,
      cropArea.x, cropArea.y, cropArea.size, cropArea.size,
      0, 0, cropArea.size, cropArea.size
    );

    const croppedImageUrl = cropCanvas.toDataURL('image/png');
    onCropComplete(croppedImageUrl);
  };

  if (!image) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-lg p-6">
          <p className="text-gray-700">画像を読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] flex flex-col">
        <h3 className="text-lg font-bold mb-2">画像を切り抜く</h3>
        <p className="text-sm text-gray-600 mb-4">青い枠をドラッグして切り抜く範囲を選択してください</p>

        <div className="mb-4 flex justify-center overflow-auto">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="border border-gray-300 cursor-move"
          />
        </div>

        <div className="flex gap-2 mt-auto">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            キャンセル
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            切り抜く
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropper;
