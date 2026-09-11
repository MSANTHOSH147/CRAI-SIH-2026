import React, { useRef } from "react";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import "./ImageUploader.css";

export default function ImageUploader({ file, preview, onFileChange, onClear, loading }) {
  const inputRef = useRef(null);
  const handleSelect = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) return;
    onFileChange(selected);
    event.target.value = "";
  };
  return (
    <section className="ai-upload-card">
      <div className="ai-upload-header">
        <div><div className="eyebrow">IMAGE OBSERVATION</div><h2>Analyze Crop Image</h2><p>Upload a crop or leaf image for CRAI disease detection.</p></div>
        <div className="ai-upload-icon"><ImageIcon size={20}/></div>
      </div>
      {!preview ? (
        <button type="button" className="ai-dropzone" onClick={() => inputRef.current?.click()} disabled={loading}>
          <div className="upload-symbol"><Upload size={22}/></div>
          <strong>{loading ? "Processing image…" : "Select an image"}</strong>
          <span>JPG, JPEG or PNG · Crop / leaf imagery</span>
          <div className="upload-button">Choose Image</div>
        </button>
      ) : (
        <div className="ai-preview">
          <img src={preview} alt="Selected crop"/>
          <div className="ai-preview-overlay"><div><span className="preview-label">SELECTED IMAGE</span><strong>{file?.name}</strong></div><button type="button" className="preview-remove" onClick={onClear} disabled={loading} aria-label="Remove image"><X size={16}/></button></div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleSelect} hidden/>
    </section>
  );
}
