import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import UploadArea from "./upload-area";
import UploadedFilesPanel from "./uploaded-files-panel";
import type { BookStructure, ChapterWithSections } from "@shared/schema";

interface BookSidebarProps {
  bookStructure?: BookStructure;
  books?: BookStructure[];
}

export default function BookSidebar({ 
  bookStructure, 
  books 
}: BookSidebarProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auto-expand all chapters when book loads
  useState(() => {
    if (bookStructure) {
      const allChapterIds = bookStructure.chapters.map(c => c.id);
      setExpandedChapters(new Set(allChapterIds));
    }
  });

  const exportMutation = useMutation({
    mutationFn: async (bookId: string) => {
      const response = await fetch(`/api/books/${bookId}/export`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${bookStructure?.title || 'book'}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Export successful",
        description: "Your book has been downloaded as Markdown",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reorganizeMutation = useMutation({
    mutationFn: async (bookId: string) => {
      const response = await fetch(`/api/books/${bookId}/reorganize`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Reorganization failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      toast({
        title: "Book reorganized",
        description: "Your book structure has been updated based on content similarity",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reorganization failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  const handleBookCreated = (book: BookStructure) => {
    setLocation(`/book/${book.id}`);
  };

  const getTotalSectionCount = (chapter: ChapterWithSections) => {
    return chapter.sections.length;
  };

  const getChunkCount = (section: any) => {
    return section.chunks?.length || 0;
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-book-open text-white text-sm"></i>
          </div>
          <Link href="/">
            <h1 className="text-xl font-semibold text-slate-800 hover:text-primary cursor-pointer">
              AI Text Organizer
            </h1>
          </Link>
        </div>
        
        {/* File Upload Area */}
        <UploadArea onBookCreated={handleBookCreated} bookId={bookStructure?.id} />
      </div>
      
      {/* Book List (when no specific book is selected) */}
      {!bookStructure && books && books.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Books</h3>
          <div className="space-y-2">
            {books.map((book) => (
              <Link key={book.id} href={`/book/${book.id}`}>
                <div className="p-3 rounded-lg hover:bg-gray-100 cursor-pointer border border-gray-200">
                  <h4 className="font-medium text-slate-800 mb-1">{book.title}</h4>
                  <p className="text-xs text-gray-500">
                    {book.chapters.length} chapters
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Book Structure Navigation */}
      {bookStructure && (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {bookStructure.chapters.map((chapter) => {
                const isExpanded = expandedChapters.has(chapter.id);
                return (
                  <div key={chapter.id} className="book-chapter">
                    <div 
                      className="flex justify-between p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => toggleChapter(chapter.id)}
                    >
                      <div className="flex items-start space-x-2 flex-1">
                        <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs text-gray-400 transition-transform mt-1`}></i>
                        <i className="fas fa-bookmark text-primary text-sm mt-1"></i>
                        <span className="font-medium text-slate-800 flex-1">{chapter.title}</span>
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {getTotalSectionCount(chapter)} sections
                      </span>
                    </div>
                    
                    {/* Chapter Sections */}
                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {chapter.sections.map((section) => (
                          <div 
                            key={section.id}
                              className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-colors hover:bg-gray-50`}
                              onClick={() => {
                                // Scroll to section logic can be added here
                                const element = document.getElementById(section.id);
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth' });
                                }
                              }}
                          >
                            <i className="fas fa-file-alt text-xs text-gray-400"></i>
                            <span className="text-sm text-gray-700">{section.title}</span>
                            <span className="text-xs text-gray-400">
                              {getChunkCount(section)} chunks
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <UploadedFilesPanel bookStructure={bookStructure} />

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button 
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              onClick={() => exportMutation.mutate(bookStructure.id)}
              disabled={exportMutation.isPending}
            >
              <i className="fas fa-download text-sm"></i>
              <span className="font-medium">
                {exportMutation.isPending ? 'Exporting...' : 'Export Book'}
              </span>
            </button>
            <button 
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              onClick={() => reorganizeMutation.mutate(bookStructure.id)}
              disabled={reorganizeMutation.isPending}
            >
              <i className="fas fa-magic text-sm"></i>
              <span className="font-medium">
                {reorganizeMutation.isPending ? 'Re-organizing...' : 'Re-organize'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
