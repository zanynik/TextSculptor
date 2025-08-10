import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ChunkEditor from "./chunk-editor";
import type { SectionWithChunks } from "@shared/schema";

interface SectionDisplayProps {
  section: SectionWithChunks;
  chapterTitle: string;
}

export default function SectionDisplay({ section, chapterTitle }: SectionDisplayProps) {
  const showSectionTitle = section.title !== "Overview";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createChunkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/sections/${section.id}/chunks`, {
        content: "",
        order: section.chunks.length,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      toast({
        title: "Paragraph added",
        description: "A new paragraph has been added to the section.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add paragraph",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div id={section.id} className="mb-12 scroll-mt-20">
      {showSectionTitle && (
        <div className="pb-4 border-b border-gray-200 mb-6">
          <h2 className="text-2xl font-bold text-slate-800">{section.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{chapterTitle}</p>
        </div>
      )}

      <div className="space-y-8">
        {section.chunks.map((chunk, index) => (
          <div key={chunk.id}>
            {chunk.title && (
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                {chunk.title}
              </h3>
            )}
            <ChunkEditor
              chunk={chunk}
              index={index}
              totalChunks={section.chunks.length}
            />
          </div>
        ))}

        {/* Add New Chunk */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary hover:bg-blue-50 transition-colors cursor-pointer"
          onClick={() => createChunkMutation.mutate()}
        >
          <i className="fas fa-plus text-xl text-gray-400 mb-2"></i>
          <p className="text-sm text-gray-600 font-medium">Add new paragraph</p>
          <p className="text-xs text-gray-500">Click to create a new text chunk</p>
        </div>
      </div>
    </div>
  );
}
