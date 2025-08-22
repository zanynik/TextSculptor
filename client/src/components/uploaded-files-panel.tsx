import { useState } from 'react';
import type { BookStructure } from '@shared/schema';

interface UploadedFilesPanelProps {
  bookStructure?: BookStructure;
}

export default function UploadedFilesPanel({ bookStructure }: UploadedFilesPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (!bookStructure || !bookStructure.originalText) {
    return null;
  }

  // This is a simplified way to split the text back into "files".
  // In a real application, you'd want a more robust way to track individual file contents.
  const files = bookStructure.originalText.split('\n\n').filter((text: string) => text.trim() !== '');

  return (
    <div className="p-4 border-t border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Uploaded Content</h3>
      <div className="space-y-2">
        {files.map((fileContent: string, index: number) => (
          <div
            key={index}
            className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer border border-gray-200"
            onClick={() => setSelectedFile(fileContent)}
          >
            <p className="text-xs text-gray-600 truncate">
              {`Content snippet ${index + 1}`}
            </p>
          </div>
        ))}
      </div>

      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
            <h4 className="text-lg font-semibold mb-4">Original Text</h4>
            <textarea
              readOnly
              className="w-full h-64 p-2 border rounded-md"
              value={selectedFile}
            />
            <button
              onClick={() => setSelectedFile(null)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
