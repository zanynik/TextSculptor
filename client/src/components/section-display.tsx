import ChunkEditor from "./chunk-editor";
import type { SectionWithChunks } from "@shared/schema";

interface SectionDisplayProps {
  section: SectionWithChunks;
  chapterTitle: string;
}

export default function SectionDisplay({ section, chapterTitle }: SectionDisplayProps) {
  return (
    <div id={section.id} className="mb-12 scroll-mt-20">
      <div className="pb-4 border-b border-gray-200 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{section.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{chapterTitle}</p>
      </div>

      <div className="space-y-6">
        {section.chunks.map((chunk, index) => (
          <ChunkEditor
            key={chunk.id}
            chunk={chunk}
            index={index}
            totalChunks={section.chunks.length}
          />
        ))}

        {/* Add New Chunk */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary hover:bg-blue-50 transition-colors cursor-pointer">
          <i className="fas fa-plus text-xl text-gray-400 mb-2"></i>
          <p className="text-sm text-gray-600 font-medium">Add new paragraph</p>
          <p className="text-xs text-gray-500">Click to create a new text chunk</p>
        </div>
      </div>
    </div>
  );
}
