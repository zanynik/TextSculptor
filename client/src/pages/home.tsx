import { useQuery } from "@tanstack/react-query";
import BookSidebar from "@/components/book-sidebar";
import type { BookStructure } from "@shared/schema";

export default function Home() {
  const { data: books } = useQuery<BookStructure[]>({
    queryKey: ["/api/books"],
  });

  return (
    <div className="min-h-screen flex bg-gray-50 font-inter antialiased">
      {/* Sidebar */}
      <BookSidebar
        books={books}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
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
      </div>
    </div>
  );
}
