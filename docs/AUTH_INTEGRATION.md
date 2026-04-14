# Frontend Authentication Integration Guide

## Overview

The frontend now uses **Better Auth** with **Zustand** for state management and **Sonner** for toast notifications, following Next.js best practices.

## Architecture

### 1. **Better Auth Client** (`src/lib/auth-client.ts`)
- Configured to connect to backend Better Auth API
- Provides authentication methods (signIn, signUp, signOut, etc.)
- Handles OAuth flows (Google, Apple)

### 2. **Zustand Auth Store** (`src/store/auth-store.ts`)
- Centralized authentication state management
- Persists auth state to localStorage
- Provides actions: login, register, logout, checkSession, OAuth methods

### 3. **Toast Provider** (`src/components/providers/ToastProvider.tsx`)
- Uses Sonner for beautiful toast notifications
- Configured with custom styling matching design system

### 4. **Auth Provider** (`src/components/providers/AuthProvider.tsx`)
- Wraps the app and handles route protection
- Automatically redirects unauthenticated users to login
- Checks session on mount

### 5. **Protected Route Component** (`src/components/auth/ProtectedRoute.tsx`)
- Wrapper component for protecting routes
- Shows loading state while checking authentication
- Redirects if not authenticated

## Usage

### In Components

```typescript
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protecting Routes

**Option 1: Using ProtectedRoute Component**
```typescript
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>Protected Content</div>
    </ProtectedRoute>
  );
}
```

**Option 2: Using useRequireAuth Hook**
```typescript
import { useRequireAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useRequireAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return null; // Will redirect

  return <div>Protected Content</div>;
}
```

### Login/Register

The login and register pages are already integrated:
- `/auth/login` - Email/password login + OAuth
- `/auth/register` - Email/password registration + OAuth

### Toast Notifications

```typescript
import { toast } from "sonner";

// Success
toast.success("Operation completed!");

// Error
toast.error("Something went wrong");

// Info
toast.info("Check this out");

// Loading
const promise = fetchData();
toast.promise(promise, {
  loading: "Loading...",
  success: "Data loaded!",
  error: "Failed to load",
});
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Authentication Flow

1. **Login/Register**: User submits form → Zustand store calls Better Auth → Session stored → Redirect
2. **Session Check**: On app load, AuthProvider checks session → Updates Zustand store
3. **Route Protection**: ProtectedRoute/useRequireAuth checks auth state → Redirects if needed
4. **API Calls**: All API requests include credentials (cookies) automatically

## OAuth Flow

1. User clicks "Continue with Google/Apple"
2. Redirects to OAuth provider
3. Provider redirects back to callback URL
4. Better Auth handles callback and creates session
5. User is authenticated

## Logout

```typescript
const { logout } = useAuth();

await logout(); // Clears session and redirects
```

## State Management

The auth store persists to localStorage and includes:
- `user`: Current user object
- `session`: Current session
- `isAuthenticated`: Boolean flag
- `isLoading`: Loading state

## API Integration

All API calls automatically include credentials (cookies) for Better Auth:

```typescript
import { drillAPI } from "@/lib/api";

// Automatically authenticated via cookies
const drills = await drillAPI.getAll();
```

## Best Practices

1. **Always use `useAuth` hook** instead of accessing store directly
2. **Use `ProtectedRoute`** for route-level protection
3. **Show loading states** while `isLoading` is true
4. **Handle errors** with toast notifications
5. **Check authentication** before making API calls

## Troubleshooting

### Session not persisting
- Check localStorage is enabled
- Verify Better Auth cookies are being set
- Check CORS settings on backend

### OAuth not working
- Verify OAuth credentials in backend `.env`
- Check redirect URIs match in OAuth provider settings
- Ensure `NEXT_PUBLIC_API_URL` is correct

### API calls failing
- Check `credentials: 'include'` is set (already done)
- Verify backend CORS allows credentials
- Check session is valid

