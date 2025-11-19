import React, { useState, useRef, useEffect, useCallback } from 'react';

function ImageCropper({ imageUrl, onCropComplete, onCancel }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [cropSize, setCropSize] = useState(200);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      // 初期サイズを画像の短辺の60%に設定（最小100px、最大500px）
      const minDimension = Math.min(img.width, img.height);
      const initialSize = Math.max(100, Math.min(minDimension * 0.6, 500));
      setCropSize(initialSize);

      // 初期位置を中央に設定
      setCropArea({
        x: (img.width - initialSize) / 2,
        y: (img.height - initialSize) / 2,
        size: initialSize
      });

      // スケールを計算（画像全体が表示されるように）
      const maxDisplaySize = 400;
      const computedScale = Math.min(1, maxDisplaySize / Math.max(img.width, img.height));
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
    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    console.log('マウスダウン:', { x, y, cropArea, scale });

    // クリックが切り抜き領域内かチェック
    if (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.size &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.size
    ) {
      console.log('ドラッグ開始');
      setIsDragging(true);
      setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !canvasRef.current || !image) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const newX = Math.max(0, Math.min(x - dragStart.x, image.width - cropArea.size));
    const newY = Math.max(0, Math.min(y - dragStart.y, image.height - cropArea.size));

    console.log('移動中:', { newX, newY });

    setCropArea(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      console.log('ドラッグ終了');
    }
    setIsDragging(false);
  };

  // タッチイベント対応
  const handleTouchStart = (e) => {
    if (!canvasRef.current || !image || e.touches.length === 0) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / scale;
    const y = (touch.clientY - rect.top) / scale;

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

  const handleTouchMove = (e) => {
    if (!isDragging || !canvasRef.current || !image || e.touches.length === 0) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / scale;
    const y = (touch.clientY - rect.top) / scale;

    const newX = Math.max(0, Math.min(x - dragStart.x, image.width - cropArea.size));
    const newY = Math.max(0, Math.min(y - dragStart.y, image.height - cropArea.size));

    setCropArea(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleSizeChange = (e) => {
    if (!image) return;
    const newSize = parseInt(e.target.value);
    const maxSize = Math.min(image.width, image.height);
    const clampedSize = Math.max(50, Math.min(newSize, maxSize));

    setCropSize(clampedSize);

    // 現在の中心点を維持しながらサイズ変更
    const centerX = cropArea.x + cropArea.size / 2;
    const centerY = cropArea.y + cropArea.size / 2;

    const newX = Math.max(0, Math.min(centerX - clampedSize / 2, image.width - clampedSize));
    const newY = Math.max(0, Math.min(centerY - clampedSize / 2, image.height - clampedSize));

    setCropArea({
      x: newX,
      y: newY,
      size: clampedSize
    });
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="border border-gray-300 cursor-move touch-none"
          />
        </div>

        {/* サイズ調整スライダー */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            切り抜きサイズ: {Math.round(cropSize)}px
          </label>
          <input
            type="range"
            min="50"
            max={image ? Math.min(image.width, image.height) : 500}
            value={cropSize}
            onChange={handleSizeChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>小</span>
            <span>大</span>
          </div>
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
