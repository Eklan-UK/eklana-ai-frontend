"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('aa@example.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.data) {
        toast.success('Login successful!');
        router.push('/admin/dashboard');
      } else {
        toast.error(result.error?.message || 'Login failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 p-8 opacity-20 pointer-events-none">
        <div className="grid grid-cols-2 gap-4">
          <div className="w-8 h-8 text-emerald-600">✱</div>
          <div className="w-8 h-8 text-emerald-600 rotate-45">➤</div>
          <div className="w-8 h-8 text-emerald-600">✱</div>
          <div className="w-8 h-8 text-emerald-600 rotate-90">➤</div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0 p-8 opacity-20 pointer-events-none">
        <div className="grid grid-cols-2 gap-4">
          <div className="w-8 h-8 text-emerald-600">✱</div>
          <div className="w-8 h-8 text-emerald-600 rotate-45">➤</div>
          <div className="w-8 h-8 text-emerald-600">✱</div>
          <div className="w-8 h-8 text-emerald-600 rotate-90">➤</div>
        </div>
      </div>

      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm mb-2 font-medium">Admin</p>
          <div className="flex items-center justify-center gap-2 mb-12">
            <Image
              src="/logo2.png"
              alt="eklan Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <h1 className="text-3xl font-bold text-gray-800">eklan</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/20 transition-all"
              placeholder="aa@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d8c40]/20 transition-all"
              placeholder="Enter your password"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-[#418b43] text-white font-semibold rounded-full hover:bg-[#3a7c3b] active:scale-[0.98] transition-all shadow-lg shadow-emerald-700/20"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
