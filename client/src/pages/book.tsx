import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BookSidebar from "@/components/book-sidebar";
import SectionDisplay from "@/components/section-display";
import type { BookStructure } from "@shared/schema";

export default function BookPage() {
  const { id } = useParams<{ id: string }>();

  const { data: bookStructure, isLoading, error } = useQuery<BookStructure>({
    queryKey: ["/api/books", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error) {
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

  if (!bookStructure) {
    return null; // Or some other placeholder
  }

  return (
    <div className="min-h-screen flex bg-gray-50 font-inter antialiased">
      {/* Sidebar */}
      <BookSidebar
        bookStructure={bookStructure}
        books={[]}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-4">
          <a href={`/book/${id}/graph`} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700">
            View Graph
          </a>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-8 w-full">
          {bookStructure.chapters.map(chapter => (
            <div key={chapter.id}>
              {chapter.sections.map(section => (
                <SectionDisplay
                  key={section.id}
                  section={section}
                  chapterTitle={chapter.title}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
