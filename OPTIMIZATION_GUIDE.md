# Next.js Optimization Guide

## ✅ Implemented Optimizations

### 1. Axios Integration
- ✅ Created centralized Axios instance (`/src/lib/api/axios.ts`)
- ✅ Updated all API calls to use Axios
- ✅ Automatic error handling and 401 redirect
- ✅ Cookie-based authentication support

### 2. Server Components
- ✅ Converted pages to Server Components where possible
- ✅ Server-side data fetching with `fetch`
- ✅ Reduced client-side JavaScript bundle
- ✅ Faster initial page loads

### 3. ISR (Incremental Static Regeneration)
- ✅ Applied ISR to static pages
- ✅ Configurable revalidation intervals
- ✅ Automatic background regeneration

## 📁 File Structure

### Server Components
```
app/
  (student)/
    account/
      page.tsx          # Server Component with ISR (30s)
      get-user.ts       # Server-side data fetching
  (tutor)/
    tutor/
      drills/
        page.tsx        # Server Component with ISR (60s)
        drills-list-client.tsx  # Client Component for interactivity
```

### API Client
```
lib/
  api/
    axios.ts           # Axios instance configuration
    api.ts             # API methods using Axios
```

## 🔧 Configuration

### ISR Revalidation
```typescript
// In page.tsx
export const revalidate = 60; // Revalidate every 60 seconds
```

### Server-Side Data Fetching
```typescript
// Server Component
async function getData() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  
  const response = await fetch(`${baseURL}/api/endpoint`, {
    credentials: 'include',
    cache: 'no-store', // For authenticated routes
    headers: {
      Cookie: cookieStore.toString(),
    },
  });
  
  return response.json();
}
```

### Client-Side with Axios
```typescript
// Client Component
import { apiRequest } from '@/lib/api';

const data = await apiRequest('/endpoint', {
  method: 'GET',
  params: { limit: 10 },
});
```

## 🚀 Performance Benefits

1. **Reduced Bundle Size**: Server Components don't ship JavaScript to client
2. **Faster Initial Load**: Data fetched on server, HTML sent directly
3. **Better SEO**: Fully rendered HTML from server
4. **ISR Caching**: Static pages regenerated in background
5. **Axios Benefits**: Better error handling, interceptors, request/response transformation

## 📊 ISR Strategy

### Pages with ISR
- **Home Page**: `revalidate = 30` (30 seconds)
- **Drills List**: `revalidate = 60` (60 seconds)
- **User Profile**: `revalidate = 0` (always fresh, authenticated)

### When to Use ISR
- ✅ Public content that changes infrequently
- ✅ Content that can be stale for a few seconds
- ✅ Pages with high traffic

### When NOT to Use ISR
- ❌ Real-time data
- ❌ User-specific authenticated content
- ❌ Highly dynamic content

## 🔄 Migration Pattern

### Before (Client Component)
```typescript
"use client";
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

export default function Page() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    apiRequest('/endpoint').then(setData);
  }, []);
  
  return <div>{/* render */}</div>;
}
```

### After (Server Component)
```typescript
import { getData } from './get-data';

export const revalidate = 60;

export default async function Page() {
  const data = await getData();
  
  return <div>{/* render */}</div>;
}
```

## 📝 Best Practices

1. **Use Server Components by default**
2. **Extract interactive parts to Client Components**
3. **Use ISR for public, semi-static content**
4. **Use `cache: 'no-store'` for authenticated routes**
5. **Pass initial data to Client Components for hydration**

## 🎯 Next Steps

- [ ] Convert more pages to Server Components
- [ ] Add ISR to public pages (blog, about, etc.)
- [ ] Implement React Suspense boundaries
- [ ] Add streaming SSR for better perceived performance
- [ ] Optimize images with Next.js Image component

