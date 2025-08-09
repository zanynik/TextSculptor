import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import ChunkEditor from "./chunk-editor";
import type { BookStructure, ChapterWithSections, SectionWithChunks } from "@shared/schema";

interface ContentEditorProps {
  bookStructure: BookStructure;
  currentSection: SectionWithChunks | null;
  currentChapter: ChapterWithSections | null;
  onSectionChange: (sectionId: string) => void;
}

export default function ContentEditor({ 
  bookStructure, 
  currentSection, 
  currentChapter,
  onSectionChange 
}: ContentEditorProps) {
  const { toast } = useToast();

  const getCurrentSectionIndex = () => {
    if (!currentChapter || !currentSection) return { current: 0, total: 0 };
    
    const chapterIndex = bookStructure.chapters.findIndex(c => c.id === currentChapter.id);
    let totalSections = 0;
    let currentIndex = 0;

    for (let i = 0; i < bookStructure.chapters.length; i++) {
      const chapter = bookStructure.chapters[i];
      if (i < chapterIndex) {
        totalSections += chapter.sections.length;
      } else if (i === chapterIndex) {
        const sectionIndex = chapter.sections.findIndex(s => s.id === currentSection.id);
        currentIndex = totalSections + sectionIndex + 1;
        totalSections += chapter.sections.length;
      } else {
        totalSections += chapter.sections.length;
      }
    }

    return { current: currentIndex, total: totalSections };
  };

  const navigateToSection = (direction: 'prev' | 'next') => {
    if (!currentChapter || !currentSection) return;

    const allSections: { id: string; chapterId: string }[] = [];
    bookStructure.chapters.forEach(chapter => {
      chapter.sections.forEach(section => {
        allSections.push({ id: section.id, chapterId: chapter.id });
      });
    });

    const currentIndex = allSections.findIndex(s => s.id === currentSection.id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < allSections.length) {
      onSectionChange(allSections[newIndex].id);
    }
  };

  const getChapterInfo = () => {
    if (!currentChapter) return "";
    
    const chapterIndex = bookStructure.chapters.findIndex(c => c.id === currentChapter.id) + 1;
    const sectionIndex = currentChapter.sections.findIndex(s => s.id === currentSection?.id) + 1;
    const totalSections = currentChapter.sections.length;
    
    return `Chapter ${chapterIndex} • Section ${sectionIndex} of ${totalSections}`;
  };

  const getSectionProgress = () => {
    if (!currentSection) return { current: 0, total: 0, percentage: 0 };
    
    const totalChunks = bookStructure.chapters.reduce((acc, chapter) => {
      return acc + chapter.sections.reduce((sectionAcc, section) => {
        return sectionAcc + (section.chunks?.length || 0);
      }, 0);
    }, 0);

    let currentChunks = 0;
    for (const chapter of bookStructure.chapters) {
      for (const section of chapter.sections) {
        if (section.id === currentSection.id) {
          break;
        }
        currentChunks += section.chunks?.length || 0;
      }
    }
    currentChunks += currentSection.chunks?.length || 0;

    return {
      current: currentChunks,
      total: totalChunks,
      percentage: totalChunks > 0 ? (currentChunks / totalChunks) * 100 : 0,
    };
  };

  const sectionProgress = getSectionProgress();
  const { current: currentSectionNum, total: totalSections } = getCurrentSectionIndex();

  return (
    <>
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {currentSection?.title || "Select a section"}
            </h2>
            <span className="text-sm text-gray-500">
              {getChapterInfo()}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <i className="fas fa-clock text-xs"></i>
              <span>Auto-save enabled</span>
            </div>
            <div className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-md">
              <i className="fas fa-save text-xs mr-1"></i>
              Auto-save: ON
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {currentSection ? (
            <div className="space-y-6">
              {currentSection.chunks.map((chunk, index) => (
                <ChunkEditor
                  key={chunk.id}
                  chunk={chunk}
                  index={index}
                  totalChunks={currentSection.chunks.length}
                />
              ))}
              
              {/* Add New Chunk */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary hover:bg-blue-50 transition-colors cursor-pointer">
                <i className="fas fa-plus text-xl text-gray-400 mb-2"></i>
                <p className="text-sm text-gray-600 font-medium">Add new paragraph</p>
                <p className="text-xs text-gray-500">Click to create a new text chunk</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-file-alt text-2xl text-primary"></i>
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-3">Select a Section</h3>
                <p className="text-gray-600">Choose a section from the sidebar to start editing your content.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Navigation */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button 
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            onClick={() => navigateToSection('prev')}
            disabled={currentSectionNum <= 1}
          >
            <i className="fas fa-chevron-left text-sm"></i>
            <span className="font-medium">Previous Section</span>
          </button>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {sectionProgress.current} of {sectionProgress.total} chunks
            </span>
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${sectionProgress.percentage}%` }}
              ></div>
            </div>
          </div>
          
          <button 
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            onClick={() => navigateToSection('next')}
            disabled={currentSectionNum >= totalSections}
          >
            <span className="font-medium">Next Section</span>
            <i className="fas fa-chevron-right text-sm"></i>
          </button>
        </div>
      </div>
    </>
  );
}
