"use client";

import React, { useEffect, useState } from 'react';
import { Calendar, Filter, Clock, Phone, ChevronRight, Loader2 } from 'lucide-react';
import { adminService } from '@/services/admin.service';

const DiscoveryCalls: React.FC = () => {
  const [calls, setCalls] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const response = await adminService.getDiscoveryCalls();
        if (response.data?.calls) {
          setCalls(response.data.calls);
        }
      } catch (error) {
        console.error('Failed to fetch discovery calls', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCalls();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discovery Calls</h1>
        <p className="text-gray-500 text-sm">Manage discovery call schedule and notes</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-gray-50 rounded-xl">
               <Calendar className="w-5 h-5 text-gray-700" />
             </div>
             <h2 className="text-lg font-semibold text-gray-800">Today's Schedule</h2>
           </div>
           <div className="flex gap-4 items-center">
             <div className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-gray-600">
               December 3, 2024
             </div>
             <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
               <Filter className="w-4 h-4" /> Filters
             </button>
           </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No discovery calls found.
            </div>
          ) : (
            calls.map((call, i) => (
            <div key={i} className="flex flex-col md:flex-row items-center justify-between p-6 bg-white border border-gray-50 rounded-2xl hover:border-emerald-100 hover:shadow-md hover:shadow-emerald-500/5 transition-all group">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                  {call.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{call.name}</h3>
                  <p className="text-sm text-gray-500">{call.email}</p>
                </div>
              </div>

              <div className="flex-1 px-8 py-4 md:py-0">
                <p className="text-sm text-gray-600">{call.message || 'No message provided'}</p>
              </div>

              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatDate(call.createdAt)}</p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500 justify-end">
                    <Clock className="w-3 h-3" /> {formatTime(call.createdAt)}
                  </p>
                </div>

                <div>
                   <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                     call.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                     call.status === 'Up coming' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                   }`}>
                     {call.status}
                   </span>
                </div>

                <button className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  call.status === 'Completed' || call.status === 'Up coming' 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-700/10' 
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}>
                  {call.status === 'Completed' ? 'Join the call' : call.status === 'Up coming' ? 'Join the call' : 'Join the call'}
                </button>
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryCalls;
