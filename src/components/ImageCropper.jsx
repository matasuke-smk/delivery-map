import React, { useState, useRef, useEffect, useCallback } from 'react';

function ImageCropper({ imageUrl, onCropComplete, onCancel }) {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [scale, setScale] = useState(1);

  // ピンチジェスチャー用の状態
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const [lastTouchCenter, setLastTouchCenter] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      // 初期サイズを画像の短辺の40%に設定
      const minDimension = Math.min(img.width, img.height);
      const initialSize = Math.max(100, Math.min(minDimension * 0.4, 500));

      // 初期位置を中央に設定
      setCropArea({
        x: (img.width - initialSize) / 2,
        y: (img.height - initialSize) / 2,
        size: initialSize
      });

      // スケールを計算（画面全体に表示）
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const computedScale = Math.min(
          containerWidth / img.width,
          containerHeight / img.height
        );
        setScale(computedScale);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ウィンドウリサイズ時のスケール調整
  useEffect(() => {
    const handleResize = () => {
      if (image && canvasRef.current) {
        const container = canvasRef.current.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const computedScale = Math.min(
          containerWidth / image.width,
          containerHeight / image.height
        );
        setScale(computedScale);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image]);

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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
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

    // 切り抜き領域の枠線（白く太めに）
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.strokeRect(scaledCrop.x, scaledCrop.y, scaledCrop.size, scaledCrop.size);

    // 四隅にハンドル（視覚的なヒント）
    const handleSize = 20;
    ctx.fillStyle = '#FFFFFF';
    const corners = [
      [scaledCrop.x, scaledCrop.y],
      [scaledCrop.x + scaledCrop.size, scaledCrop.y],
      [scaledCrop.x, scaledCrop.y + scaledCrop.size],
      [scaledCrop.x + scaledCrop.size, scaledCrop.y + scaledCrop.size]
    ];
    corners.forEach(([x, y]) => {
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    });
  }, [image, cropArea, scale]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // 2点間の距離を計算
  const getTouchDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 2点の中心点を計算
  const getTouchCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleTouchStart = (e) => {
    if (!canvasRef.current || !image) return;
    e.preventDefault();

    if (e.touches.length === 2) {
      // 2本指の場合：ピンチジェスチャーの初期化
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const center = getTouchCenter(e.touches[0], e.touches[1]);
      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    }
  };

  const handleTouchMove = (e) => {
    if (!canvasRef.current || !image) return;
    e.preventDefault();

    if (e.touches.length === 2 && lastTouchDistance && lastTouchCenter) {
      // 2本指の場合：ピンチ＆ドラッグ
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();

      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const currentCenter = getTouchCenter(e.touches[0], e.touches[1]);

      // ピンチによるサイズ変更
      const distanceRatio = currentDistance / lastTouchDistance;
      const newSize = cropArea.size * distanceRatio;
      const minSize = 50;
      const maxSize = Math.min(image.width, image.height);
      const clampedSize = Math.max(minSize, Math.min(newSize, maxSize));

      // 2本指ドラッグによる位置変更
      const centerDeltaX = (currentCenter.x - lastTouchCenter.x) / scale;
      const centerDeltaY = (currentCenter.y - lastTouchCenter.y) / scale;

      // 中心点を維持しながらサイズ変更
      const cropCenterX = cropArea.x + cropArea.size / 2;
      const cropCenterY = cropArea.y + cropArea.size / 2;

      // 新しい位置を計算（ドラッグ分も考慮）
      const newX = cropCenterX - clampedSize / 2 + centerDeltaX;
      const newY = cropCenterY - clampedSize / 2 + centerDeltaY;

      // 画像の範囲内に制限
      const clampedX = Math.max(0, Math.min(newX, image.width - clampedSize));
      const clampedY = Math.max(0, Math.min(newY, image.height - clampedSize));

      setCropArea({
        x: clampedX,
        y: clampedY,
        size: clampedSize
      });

      setLastTouchDistance(currentDistance);
      setLastTouchCenter(currentCenter);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      // 2本指が離れたらリセット
      setLastTouchDistance(null);
      setLastTouchCenter(null);
    }
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
      <div className="fixed inset-0 bg-black flex items-center justify-center z-[60]">
        <div className="flex items-center gap-3 text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="text-lg font-medium">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      {/* キャンバスエリア（全画面） */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="touch-none"
        />

        {/* 操作説明（オーバーレイ） */}
        <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black bg-opacity-70 backdrop-blur-sm px-6 py-3 rounded-full">
            <p className="text-white text-sm font-medium">
              2本指でピンチして拡大縮小・移動
            </p>
          </div>
        </div>
      </div>

      {/* 下部ボタン */}
      <div className="bg-black bg-opacity-90 backdrop-blur-sm p-4 flex gap-3 border-t border-gray-700">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-4 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-600 transition-all active:scale-95"
        >
          キャンセル
        </button>
        <button
          onClick={handleCrop}
          className="flex-1 px-6 py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all active:scale-95"
        >
          完了
        </button>
      </div>
    </div>
  );
}

export default ImageCropper;
