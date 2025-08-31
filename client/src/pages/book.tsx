import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BookSidebar from "@/components/book-sidebar";
import SectionDisplay from "@/components/section-display";
import type { BookStructure } from "@shared/schema";
import { useState } from "react";

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);

  const { data: bookStructure, isLoading, error } = useQuery<BookStructure>({
    queryKey: ["/api/books", id],
    enabled: !!id,
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !id) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`/api/books/${id}/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const results = await response.json();
      setSearchResults(results.map((r: any) => r.id));
    } catch (err) {
      console.error(err);
      // Handle error (e.g., show a toast notification)
    }
  };

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
        <div className="p-4 flex justify-between items-center">
          <a href={`/book/${id}/graph`} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700">
            View Graph
          </a>
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in book..."
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Search
            </button>
          </form>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-8 w-full">
          {bookStructure.chapters
            .map(chapter => ({
              ...chapter,
              sections: chapter.sections
                .map(section => ({
                  ...section,
                  chunks: section.chunks.filter(chunk => searchResults.length === 0 || searchResults.includes(chunk.id)),
                }))
                .filter(section => section.chunks.length > 0),
            }))
            .filter(chapter => chapter.sections.length > 0)
            .map(chapter => (
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
