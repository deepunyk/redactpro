/**
 * PDFUploader Component
 * Professional drag-and-drop zone for uploading PDF files
 */

import React, { useCallback, useState } from 'react';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({
  onFileSelect,
  disabled = false,
  accept = 'application/pdf',
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const pdfFile = files.find((file) => file.type === 'application/pdf');

      if (pdfFile) {
        onFileSelect(pdfFile);
      }
    },
    [disabled, onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-lg p-10 text-center transition-all
        ${isDragging
          ? 'border-gray-400 bg-gray-50 dark:bg-gray-900'
          : 'border-gray-300 dark:border-gray-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-600'}
      `}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        data-testid="pdf-file-input"
      />

      <div className="space-y-4 pointer-events-none">
        <div className="flex justify-center">
          <svg
            className="w-14 h-14 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <div>
          <p className="text-base font-medium text-gray-700 dark:text-gray-200">
            Drop your PDF here
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            or click to browse
          </p>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Maximum file size: 50MB
        </p>
      </div>
    </div>
  );
};
