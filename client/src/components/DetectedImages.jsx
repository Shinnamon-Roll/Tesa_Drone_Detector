import React, { useState, useEffect } from "react";
import "./DetectedImages.css";

// Use relative paths to work with Vite proxy in dev and production
const API_BASE = "";

export function DetectedImages() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchImages();
    // Also check debug endpoint
    checkDebugInfo();
  }, []);

  const checkDebugInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/debug/paths`);
      const data = await response.json();
      console.log("[DetectedImages] Debug info:", data);
    } catch (err) {
      console.warn("[DetectedImages] Could not fetch debug info:", err);
    }
  };

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${API_BASE}/api/detected/images`;
      console.log(`[DetectedImages] Fetching from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[DetectedImages] HTTP ${response.status}:`, errorData);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to fetch images`);
      }
      
      const data = await response.json();
      console.log(`[DetectedImages] Received ${data.images?.length || 0} images:`, data.images?.slice(0, 5));
      setImages(data.images || []);
      
      // Set the newest image (first in the list) as selected by default
      if (data.images && data.images.length > 0) {
        setSelectedImage(data.images[0]);
      }
    } catch (err) {
      console.error("[DetectedImages] Error fetching images:", err);
      setError(err.message || "Failed to load images. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="detected-images-container">
        <div className="loading">Loading images...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="detected-images-container">
        <div className="error">Error: {error}</div>
        <button onClick={fetchImages} className="retry-button">Retry</button>
      </div>
    );
  }

  return (
    <div className="detected-images-container">
      <div className="detected-images-header">
        <h2>Detected Images</h2>
        <div className="image-count">{images.length} images</div>
        <button onClick={fetchImages} className="refresh-button" title="Refresh images">
          ↻ Refresh
        </button>
      </div>
      
      <div className="detected-images-layout">
        {/* Image List - Scrollable */}
        <div className="image-list-container">
          <div className="image-list-header">All Images (Newest First)</div>
          <div className="image-list">
            {images.length === 0 ? (
              <div className="no-images">No images found</div>
            ) : (
              images.map((imageName, index) => (
                <div
                  key={imageName}
                  className={`image-item ${selectedImage === imageName ? "selected" : ""}`}
                  onClick={() => setSelectedImage(imageName)}
                >
                  <img
                    src={`${API_BASE}/api/detected/images/${imageName}`}
                    alt={imageName}
                    loading="lazy"
                    onError={(e) => {
                      console.error(`[DetectedImages] Failed to load image: ${imageName}`);
                      e.target.style.display = "none";
                    }}
                  />
                  <div className="image-name">{imageName}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Image Display */}
        <div className="selected-image-container">
          <div className="selected-image-header">
            {selectedImage ? (
              <>
                <span>Last Detected: {selectedImage}</span>
                <span className="image-index">
                  {images.indexOf(selectedImage) + 1} of {images.length}
                </span>
              </>
            ) : (
              <span>Select an image to view</span>
            )}
          </div>
          {selectedImage && (
            <div className="selected-image-wrapper">
              <img
                src={`${API_BASE}/api/detected/images/${selectedImage}`}
                alt={selectedImage}
                className="selected-image"
                onError={(e) => {
                  console.error(`[DetectedImages] Failed to load selected image: ${selectedImage}`);
                  e.target.alt = "Failed to load image";
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

