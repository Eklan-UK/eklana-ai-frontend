"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Trash2, Volume2, ArrowRight, Quote, FileText, Calendar, BookOpen } from "lucide-react";

interface BookmarkCardProps {
  bookmark: {
    _id: string;
    drillId: string;
    type: 'word' | 'sentence';
    content: string;
    translation?: string;
    context?: string;
    createdAt: string;
  };
  onDelete: (id: string, e: React.MouseEvent) => void;
  onPlay: (content: string, e: React.MouseEvent) => void;
  onPractice: (id: string, e: React.MouseEvent) => void;
  onGoToDrill: (drillId: string, e: React.MouseEvent) => void;
}

export function BookmarkCard({ bookmark, onDelete, onPlay, onPractice, onGoToDrill }: BookmarkCardProps) {
  return (
    <Card 
      className="group relative overflow-hidden transition-all duration-300 hover:shadow-md border border-gray-100 hover:border-green-200 bg-white"
      onClick={(e: React.MouseEvent) => onPractice(bookmark._id, e)}
    >
      <div className="p-1">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${
              bookmark.type === 'word' 
                ? 'bg-green-50 text-green-600' 
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {bookmark.type === 'word' ? <FileText className="w-3.5 h-3.5" /> : <Quote className="w-3.5 h-3.5" />}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              bookmark.type === 'word' 
                ? 'bg-green-50 text-green-700' 
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              {bookmark.type === 'word' ? 'Word' : 'Sentence'}
            </span>
          </div>
          
          <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            <Calendar className="w-3 h-3" />
            {new Date(bookmark.createdAt).toLocaleDateString()}
          </div>
        </div>

        <div className="mb-2">
          <h3 className="text-lg font-bold text-gray-900 leading-tight mb-0.5 line-clamp-1 group-hover:text-green-600 transition-colors">
            {bookmark.content}
          </h3>
          
          {bookmark.translation && (
            <p className="text-gray-500 text-sm font-medium line-clamp-1">
              {bookmark.translation}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              className="p-0 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={(e) => onDelete(bookmark._id, e)}
              title="Delete bookmark"
            >
              <Trash2 className="" />
              </Button>
            
          
            <Button
              variant="ghost"
              size="sm"
              className=" p-0 flex gap-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              onClick={(e) => onGoToDrill(bookmark.drillId, e)}
              title="Go to Drill"
            >Go to Drill
              <BookOpen className="" />
            </Button> 
          </div>

          <Button 
            size="sm" 
            className="gap-1.5 text-xs font-semibold px-3 h-8 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm group-hover:shadow-md transform group-hover:translate-x-1 duration-200"
            onClick={(e) => onPractice(bookmark._id, e)}
          >
            Practice <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
