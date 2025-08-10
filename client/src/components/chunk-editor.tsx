import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Slider } from "@/components/ui/slider";
import type { Chunk } from "@shared/schema";

interface ChunkEditorProps {
  chunk: Chunk;
  index: number;
  totalChunks: number;
}

export default function ChunkEditor({ chunk, index, totalChunks }: ChunkEditorProps) {
  const [content, setContent] = useState(chunk.content);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const response = await apiRequest('PATCH', `/api/chunks/${chunk.id}`, {
        content: newContent,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      toast({
        title: "Chunk updated",
        description: "Content has been saved and re-embedded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
      // Revert content on error
      setContent(chunk.content);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/chunks/${chunk.id}`, undefined);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      toast({
        title: "Chunk deleted",
        description: "The text chunk has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (direction: 'up' | 'down') => {
      const response = await apiRequest('POST', `/api/chunks/${chunk.id}/reorder`, { direction });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/books'] });
      toast({
        title: "Chunk moved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Move failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBlur = () => {
    if (content !== chunk.content && content.trim()) {
      updateMutation.mutate(content);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setContent(chunk.content);
      setIsEditing(false);
    }
  };

  const [rewriteLevel, setRewriteLevel] = useState(0.5);
  const [rewrittenContent, setRewrittenContent] = useState<string | null>(null);

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/chunks/${chunk.id}/rewrite`, {
        rewriteLevel,
      });
      const data = await response.json();
      return data.content;
    },
    onSuccess: (newContent: string) => {
      setRewrittenContent(newContent);
      toast({
        title: "Rewrite suggestion ready",
        description: "Review the suggestion and apply or discard.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rewrite failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFocus = () => {
    setIsEditing(true);
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [content]);

  const getEmbeddingStatus = () => {
    if (updateMutation.isPending) {
      return {
        icon: "animate-pulse w-2 h-2 bg-yellow-500 rounded-full",
        text: "Re-embedding...",
        color: "text-yellow-600",
      };
    }
    
    if (chunk.isEmbedded) {
      return {
        icon: "w-2 h-2 bg-green-500 rounded-full",
        text: "Embedded",
        color: "text-green-600",
      };
    }
    
    return {
      icon: "w-2 h-2 bg-gray-400 rounded-full",
      text: "Not embedded",
      color: "text-gray-500",
    };
  };

  const embeddingStatus = getEmbeddingStatus();

  return (
    <div className="content-chunk group relative">
      <div className="absolute left-0 top-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-r"></div>
      <div className="pl-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Chunk {index + 1}
            </span>
            {chunk.similarity && (
              <span className="text-xs text-gray-400">
                {Math.round(chunk.similarity * 100)}% similarity
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Move up"
              disabled={index === 0 || reorderMutation.isPending}
              onClick={() => reorderMutation.mutate('up')}
            >
              <i className="fas fa-arrow-up text-xs"></i>
            </button>
            <button 
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Move down"
              disabled={index === totalChunks - 1 || reorderMutation.isPending}
              onClick={() => reorderMutation.mutate('down')}
            >
              <i className="fas fa-arrow-down text-xs"></i>
            </button>
            <button 
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              title="Delete"
            >
              <i className="fas fa-trash text-xs"></i>
            </button>
          </div>
        </div>

        <div className="prose prose-slate max-w-none">
          <div className={`bg-white border border-gray-200 rounded-lg p-4 transition-colors ${
            isEditing ? 'border-primary shadow-sm' : 'hover:border-gray-300'
          }`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full resize-none border-none outline-none bg-transparent font-normal text-gray-900 leading-relaxed"
              style={{ minHeight: '100px' }}
              placeholder="Enter your text here..."
            />
          </div>
        </div>

        {/* AI Rewrite Toolbar */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">AI Rewrite</label>
            <button
              className="px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              onClick={() => rewriteMutation.mutate()}
              disabled={rewriteMutation.isPending}
            >
              {rewriteMutation.isPending ? 'Generating...' : 'Rewrite'}
            </button>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={[rewriteLevel]}
            onValueChange={(value: number[]) => setRewriteLevel(value[0])}
          />
        </div>

        {/* Rewritten Content Display */}
        {rewrittenContent && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-2">Suggested Rewrite:</p>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{rewrittenContent}</p>
            <div className="mt-4 flex space-x-2">
              <button
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                onClick={() => {
                  setContent(rewrittenContent);
                  setRewrittenContent(null);
                  updateMutation.mutate(rewrittenContent);
                }}
              >
                Apply
              </button>
              <button
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                onClick={() => setRewrittenContent(null)}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Embedding Status */}
        <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <div className={embeddingStatus.icon}></div>
            <span className={embeddingStatus.color}>{embeddingStatus.text}</span>
          </div>
          <span>•</span>
          <span>
            {new Date(chunk.updatedAt || chunk.createdAt || Date.now()).toLocaleString()}
          </span>
          <span>•</span>
          <span>{chunk.wordCount || content.split(/\s+/).length} words</span>
          {isEditing && (
            <>
              <span>•</span>
              <span className="text-blue-600">Press Ctrl+Enter to save</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
