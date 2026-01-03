"use client";

import React from 'react';
import { Calendar, Filter, Clock, Phone, ChevronRight } from 'lucide-react';

const DiscoveryCalls: React.FC = () => {
  const calls = [
    { name: 'Alex Chen', email: 'alex@email.com', purpose: 'Working holiday / planning to travel', date: 'Dec 3, 2024', time: '10:00 AM', status: 'Completed' },
    { name: 'Maria Garcia', email: 'maria@email.com', purpose: 'Preparing for future opportunities', date: 'Dec 6, 2024', time: '11:30 AM', status: 'Completed' },
    { name: 'Yuki Tanaka', email: 'yuki@email.com', purpose: 'Working holiday / planning to travel', date: 'Dec 3, 2024', time: '10:00 AM', status: 'Up coming' },
    { name: 'David Lee', email: 'david@email.com', purpose: 'Working holiday / planning to travel', date: 'Dec 3, 2024', time: '10:00 AM', status: 'No-show' },
  ];

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
          {calls.map((call, i) => (
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
                <p className="text-sm text-gray-600">{call.purpose}</p>
              </div>

              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{call.date}</p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500 justify-end">
                    <Clock className="w-3 h-3" /> {call.time}
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryCalls;
