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
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-purple-600 bg-opacity-95 flex items-center justify-center z-[60] backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-gray-700 font-medium">画像を読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-purple-600 bg-opacity-95 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
          <h3 className="text-xl font-bold mb-2">✨ アイコンを作成</h3>
          <p className="text-sm text-blue-100">青い枠をドラッグして切り抜く範囲を調整</p>
        </div>

        {/* コンテンツエリア */}
        <div className="p-6 flex-1 overflow-auto">
          {/* プレビューエリア */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="rounded-lg shadow-lg cursor-move touch-none border-4 border-gray-100"
              />
              <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md border border-gray-200">
                <span className="text-xs font-medium text-gray-600">ドラッグで移動</span>
              </div>
            </div>
          </div>

          {/* サイズ調整スライダー */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">
                📏 切り抜きサイズ
              </label>
              <span className="text-lg font-bold text-blue-600">{Math.round(cropSize)}px</span>
            </div>
            <input
              type="range"
              min="50"
              max={image ? Math.min(image.width, image.height) : 500}
              value={cropSize}
              onChange={handleSizeChange}
              className="w-full h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full appearance-none cursor-pointer slider-thumb"
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span className="font-medium">🔍 小</span>
              <span className="font-medium">🔎 大</span>
            </div>
          </div>
        </div>

        {/* フッターボタン */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
          >
            ✓ 完了
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
          transition: transform 0.2s;
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .slider-thumb::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
          transition: transform 0.2s;
          border: none;
        }
        .slider-thumb::-moz-range-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}

export default ImageCropper;
