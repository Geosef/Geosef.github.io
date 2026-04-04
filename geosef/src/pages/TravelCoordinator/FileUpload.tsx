import React, { useCallback } from 'react';
import Papa from 'papaparse';
import './TravelCoordinator.css';

interface FileUploadProps {
  onDataUpload: (data: any[]) => void;
  accept: string;
  id: string;
  label: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataUpload, accept, id, label }) => {
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          onDataUpload(results.data);
        },
        header: false,
        skipEmptyLines: true
      });
    }
  }, [onDataUpload]);

  return (
    <div className="file-upload">
      <label htmlFor={id}>{label}</label>
      <input
        type="file"
        id={id}
        accept={accept}
        onChange={handleFileUpload}
      />
    </div>
  );
};

export default FileUpload;