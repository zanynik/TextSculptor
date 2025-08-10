import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { BookStructure } from "@shared/schema";

interface UploadAreaProps {
  onBookCreated?: (book: BookStructure) => void;
  bookId?: string | null;
}

export default function UploadArea({ onBookCreated, bookId }: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      if (bookId) {
        formData.append('bookId', bookId);
      }
      
      const response = await apiRequest('POST', '/api/upload', formData);
      return response.json();
    },
    onSuccess: (data: BookStructure) => {
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      toast({
        title: "File processed successfully",
        description: `Your text has been organized into ${data.chapters.length} chapters.`,
      });
      onBookCreated?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (file.type !== 'text/plain') {
        toast({
          title: "Invalid file type",
          description: `Skipping non-txt file: ${file.name}`,
          variant: "destructive",
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `Skipping file larger than 10MB: ${file.name}`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      uploadMutation.mutate(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(Array.from(files));
    }
  };

  return (
    <div className="relative">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary bg-blue-50'
            : uploadMutation.isPending
            ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-primary hover:bg-blue-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!uploadMutation.isPending ? handleClick : undefined}
      >
        {uploadMutation.isPending ? (
          <div className="space-y-2">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-gray-600 font-medium">Processing with AI...</p>
          </div>
        ) : (
          <>
            <i className="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
            <p className="text-sm text-gray-600 font-medium">Drop your .txt file(s) here</p>
            <p className="text-xs text-gray-500">or click to browse</p>
          </>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={uploadMutation.isPending}
      />

      {uploadMutation.isPending && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
            <span className="text-sm text-blue-700 font-medium">Processing with AI...</span>
          </div>
          <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-300 w-3/4"></div>
          </div>
        </div>
      )}
    </div>
  );
}
