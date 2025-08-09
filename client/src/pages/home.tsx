import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import UploadArea from "@/components/upload-area";
import BookSidebar from "@/components/book-sidebar";
import ContentEditor from "@/components/content-editor";
import type { BookStructure } from "@shared/schema";

export default function Home() {
  const { id } = useParams<{ id?: string }>();
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);

  const { data: bookStructure, isLoading, error } = useQuery<BookStructure>({
    queryKey: ["/api/books", id],
    enabled: !!id,
  });

  const { data: books } = useQuery<BookStructure[]>({
    queryKey: ["/api/books"],
    enabled: !id,
  });

  // Set default section when book loads
  useState(() => {
    if (bookStructure && !currentSectionId) {
      const firstSection = bookStructure.chapters[0]?.sections[0];
      if (firstSection) {
        setCurrentSectionId(firstSection.id);
      }
    }
  });

  const getCurrentSection = () => {
    if (!bookStructure || !currentSectionId) return null;
    
    for (const chapter of bookStructure.chapters) {
      for (const section of chapter.sections) {
        if (section.id === currentSectionId) {
          return { section, chapter };
        }
      }
    }
    return null;
  };

  const currentData = getCurrentSection();
  const showWelcome = !id && (!books || books.length === 0);
  const showBookContent = id && bookStructure;

  if (id && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading book...</p>
        </div>
      </div>
    );
  }

  if (id && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load book</p>
          <button 
            onClick={() => window.location.href = "/"}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 font-inter antialiased">
      {/* Sidebar */}
      <BookSidebar
        bookStructure={bookStructure}
        currentSectionId={currentSectionId}
        onSectionSelect={setCurrentSectionId}
        books={books}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {showWelcome && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md mx-auto text-center px-6">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="fas fa-file-upload text-2xl text-primary"></i>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">
                Transform Your Notes into Books
              </h3>
              <p className="text-gray-600 mb-6">
                Upload your .txt files and let AI organize them into coherent chapters and sections. 
                Edit and refine your content with intelligent clustering.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <i className="fas fa-check text-green-600 text-xs"></i>
                  <span>AI-powered text chunking</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <i className="fas fa-check text-green-600 text-xs"></i>
                  <span>Smart clustering & organization</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <i className="fas fa-check text-green-600 text-xs"></i>
                  <span>Real-time editing & re-embedding</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {showBookContent && (
          <ContentEditor
            bookStructure={bookStructure}
            currentSection={currentData?.section || null}
            currentChapter={currentData?.chapter || null}
            onSectionChange={setCurrentSectionId}
          />
        )}
      </div>
    </div>
  );
}
