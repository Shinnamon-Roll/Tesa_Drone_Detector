import React, { useState, useEffect } from "react";
import "./DetectedImages.css";

const API_BASE = "http://localhost:3000";

export function DetectedImages() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/api/detected/images`);
      if (!response.ok) {
        throw new Error("Failed to fetch images");
      }
      const data = await response.json();
      setImages(data.images || []);
      // Set the newest image (first in the list) as selected by default
      if (data.images && data.images.length > 0) {
        setSelectedImage(data.images[0]);
      }
    } catch (err) {
      console.error("Error fetching images:", err);
      setError(err.message);
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

