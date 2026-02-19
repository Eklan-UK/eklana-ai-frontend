"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { BookmarkCard } from "@/components/bookmarks/BookmarkCard";
import { toast } from "sonner";
import { useTTS } from "@/hooks/useTTS";
import { Loader2, Bookmark } from "lucide-react";

interface Bookmark {
  _id: string;
  drillId: string;
  type: 'word' | 'sentence';
  content: string;
  translation?: string;
  context?: string;
  createdAt: string;
}

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const { playAudio } = useTTS();

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const response = await fetch('/api/v1/bookmarks');
      if (!response.ok) throw new Error('Failed to fetch bookmarks');
      const data = await response.json();
      setBookmarks(data.bookmarks);
    } catch (error) {
      toast.error('Could not load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this bookmark?')) return;

    try {
      const response = await fetch(`/api/v1/bookmarks/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      
      setBookmarks(bookmarks.filter(b => b._id !== id));
      toast.success('Bookmark removed');
    } catch (error) {
      toast.error('Could not delete bookmark');
    }
  };

  const handlePlay = (content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playAudio(content);
  };

  const handlePractice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/account/practice/bookmark/${id}`);
  };

  const handleGoToDrill = (drillId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/account/drills/${drillId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="h-6"></div>
      <Header title="My Bookmarks" showBack={false} />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-green-500" />
            <p className="text-sm font-medium">Loading your bookmarks...</p>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bookmark className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookmarks yet</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Bookmark words and sentences during your drills to build your personal practice list.
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {bookmarks.map((bookmark) => (
              <BookmarkCard 
                key={bookmark._id} 
                bookmark={bookmark}
                onDelete={handleDelete}
                onPlay={handlePlay}
                onPractice={handlePractice}
                onGoToDrill={handleGoToDrill}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
