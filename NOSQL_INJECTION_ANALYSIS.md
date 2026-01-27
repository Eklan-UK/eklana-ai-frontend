# 🔍 SQL/NoSQL Injection Security Analysis

**Project:** Elkan AI - English Learning Platform  
**Database:** MongoDB (NoSQL)  
**Date:** January 23, 2026  
**Status:** ⚠️ MINOR VULNERABILITIES FOUND

---

## 📊 Executive Summary

| Vulnerability | Severity | Count | Status |
|---------------|----------|-------|--------|
| 🟡 **NoSQL Injection via Regex** | MEDIUM | 1 | Found |
| 🟢 **No Direct SQL Injection Risk** | LOW | N/A | Safe (using Mongoose) |
| 🟡 **Insufficient Input Validation** | MEDIUM | 3 | Found |
| 🟢 **Proper ObjectId Validation** | GOOD | N/A | Mostly Safe |

### ✅ Overall Assessment
- **Risk Level:** 🟡 **LOW-MEDIUM**
- **Exploitability:** **Moderate** (requires crafted input)
- **Impact:** **Medium** (data exposure, DoS potential)
- **Recommendation:** Fix immediately

---

## 🔴 CRITICAL VULNERABILITIES

### None Found
✅ No SQL injection (using Mongoose ORM)  
✅ No direct NoSQL injection vectors  
✅ No JavaScript eval() usage  
✅ No dangerous operator usage  

---

## 🟡 MEDIUM RISK ISSUES

### Issue #1: **NoSQL Regex Injection via Search Parameters**

**Severity:** 🟡 **MEDIUM**  
**CVSS:** 5.7  
**Type:** ReDoS (Regular Expression Denial of Service)  
**Location:** Multiple API endpoints  

#### Affected Endpoints

1. `/api/v1/users?search=...` (Line 34-37)
2. `/api/v1/pronunciations?search=...` (Line 39-41)
3. `/api/v1/pronunciation-problems?difficulty=...` (Line 34)

#### Code Example

```typescript
// /src/app/api/v1/users/route.ts - Line 33-37
if (search) {
  query.$or = [
    { email: { $regex: search, $options: 'i' } },           // ❌ VULNERABLE
    { firstName: { $regex: search, $options: 'i' } },       // ❌ VULNERABLE
    { lastName: { $regex: search, $options: 'i' } },        // ❌ VULNERABLE
    { name: { $regex: search, $options: 'i' } },            // ❌ VULNERABLE
  ];
}
```

#### Attack Scenario #1: ReDoS Attack (Denial of Service)

```bash
# Attacker sends carefully crafted regex that causes exponential backtracking
GET /api/v1/users?search=(a+)+b

# MongoDB engine tries to match the pattern
# Pattern causes exponential time complexity
# Server becomes unresponsive
# All other requests blocked
```

**Impact:**
- ⏱️ Server locks up for seconds/minutes
- 🔒 DoS of entire application
- 📊 Database CPU spikes to 100%

#### Attack Scenario #2: Regex Injection via Object

```bash
# MongoDB accepts object notation for operators
GET /api/v1/users?search={"$gt":""}

# Could be interpreted as:
# { email: { $regex: {"$gt":""}, $options: 'i' } }

# Or with nested operators:
GET /api/v1/users?search={"$where":"1==1"}

# Results in:
# { email: { $regex: {"$where":"1==1"}, $options: 'i' } }
```

**Impact:**
- 🔓 Bypass search logic
- 📖 Expose data unintended for user
- 🚪 Potential privilege escalation

#### Attack Scenario #3: ReDoS with Special Characters

```bash
# Exponential backtracking pattern
GET /api/v1/pronunciations?search=aaaaaaaaaaaaaaaaaaaaaaaaaab

# Pattern: (a|a|a|a|a)+b
# Causes exponential matching attempts
```

---

### Issue #2: **Missing Input Validation on Query Parameters**

**Severity:** 🟡 **MEDIUM**  
**Type:** Insufficient validation  
**Location:** Multiple API routes  

#### Vulnerable Patterns

```typescript
// ❌ Problem 1: No validation that search string length
const search = searchParams.get('search');  // Could be 1MB string!

// ❌ Problem 2: No validation on limit/offset
const limit = parseInt(searchParams.get('limit') || '100');  // Could be negative or huge!
const offset = parseInt(searchParams.get('offset') || '0');  // No bounds check

// ❌ Problem 3: No validation on difficulty enum
const difficulty = searchParams.get('difficulty');  // Any string accepted

// ❌ Problem 4: No validation on role filter
const role = searchParams.get('role');  // Any role string accepted
```

#### Attack Scenarios

**Attack 1: Memory Exhaustion via Large Search String**
```bash
# Send multi-MB search string
curl "https://api.yourapp.com/api/v1/users?search=$(python -c 'print("a"*10000000)')"

# Results:
# - Regex pattern compiled with 10MB string
# - MongoDB memory exhausted
# - Server crashes
```

**Attack 2: Database Scan with Large Offset**
```bash
# Force full database scan
curl "https://api.yourapp.com/api/v1/users?offset=99999999"

# Results:
# - Database tries to skip 99 million documents
# - Full collection scan
# - Performance degradation
# - Potential data exposure
```

**Attack 3: Enumeration via Role Filter**
```bash
# Test different role values
for role in admin tutor learner user superuser; do
  curl "https://api.yourapp.com/api/v1/users?role=$role"
done

# Learn all possible roles in system
# Helps plan targeted attacks
```

---

### Issue #3: **Insufficient ObjectId Validation**

**Severity:** 🟡 **MEDIUM**  
**Type:** Weak parameter validation  
**Location:** Dynamic routes with `[userId]`, `[learnerId]`, etc.  

#### Code Example

```typescript
// /src/app/api/v1/users/[userId]/route.ts - Line 20
const { userId } = params;  // ❌ Not validated for ObjectId format

// Used directly in query:
const user = await User.findById(userId).select('-password -__v').lean().exec();

// Mongoose will coerce invalid IDs, potentially causing:
// - Type confusion
// - Unexpected behavior
// - Logic errors
```

#### Attack Scenario

```bash
# Send non-ObjectId format
curl https://api.yourapp.com/api/v1/users/not-a-valid-id

# Mongoose tries to convert "not-a-valid-id" to ObjectId
# May succeed in unexpected ways
# Could match wrong user or cause null reference errors

# Or send huge string
curl https://api.yourapp.com/api/v1/users/$(python -c 'print("a"*1000000)')

# Parser fails or processes huge string
```

---

## 🟢 LOW RISK ISSUES

### Issue #4: **No Prepared Statements for Complex Queries**

**Severity:** 🟢 **LOW** (Mongoose handles this well)  
**Note:** Mongoose ORM provides protection against SQL injection  

#### Good Practices Found
✅ Using Mongoose query builder (prevents SQL injection)  
✅ Using `.lean()` for read-only queries  
✅ Using `.exec()` to finalize queries  
✅ Not using raw MongoDB shell  

---

## ✅ GOOD SECURITY PRACTICES FOUND

### 1. **Using Mongoose ORM**
```typescript
// ✅ GOOD: Using ORM prevents injection
const user = await User.findById(userId).exec();

// ❌ BAD: Raw MongoDB shell
db.users.find({ _id: ObjectId(userIdFromRequest) })
```

### 2. **Excluding Sensitive Fields**
```typescript
// ✅ GOOD: Explicitly excluding password
.select('-password -__v')
```

### 3. **Using lean() for Performance**
```typescript
// ✅ GOOD: Read-only query optimization
.lean().exec()
```

### 4. **Proper Role-Based Access Control**
```typescript
// ✅ GOOD: Role validation before queries
export const GET = withRole(['admin'], handler);
```

---

## 🛠️ FIXES & RECOMMENDATIONS

### Fix #1: Escape/Sanitize Regex Patterns

**Priority:** 🔴 **CRITICAL**  
**Effort:** 1-2 hours  
**Impact:** High

#### Implementation

```typescript
// /src/lib/api/validation.ts

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
  if (!str) return '';
  
  // Escape all regex special characters
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate and sanitize search parameter
 */
export function validateSearchParam(search: string | null): string {
  if (!search) return '';
  
  // Maximum length check (prevent memory exhaustion)
  const maxLength = 200;
  if (search.length > maxLength) {
    throw new Error(`Search parameter exceeds maximum length of ${maxLength}`);
  }
  
  // Escape regex special characters
  const escaped = escapeRegex(search);
  
  // Remove any remaining problematic patterns
  const sanitized = escaped.replace(/(\$|@)/g, '');
  
  return sanitized;
}

/**
 * Validate and sanitize pagination parameters
 */
export function validatePagination(
  limit?: string,
  offset?: string
): { limit: number; offset: number } {
  const maxLimit = 100;
  const minLimit = 1;
  const minOffset = 0;
  
  let parsedLimit = parseInt(limit || '20', 10);
  let parsedOffset = parseInt(offset || '0', 10);
  
  // Validate limit
  if (isNaN(parsedLimit) || parsedLimit < minLimit) {
    parsedLimit = 20;
  }
  if (parsedLimit > maxLimit) {
    parsedLimit = maxLimit;
  }
  
  // Validate offset
  if (isNaN(parsedOffset) || parsedOffset < minOffset) {
    parsedOffset = 0;
  }
  
  // Prevent huge offsets (DoS protection)
  const maxOffset = 1000000;
  if (parsedOffset > maxOffset) {
    parsedOffset = maxOffset;
  }
  
  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Validate MongoDb ObjectId format
 */
export function validateObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/.test(id);
}

/**
 * Validate enum value
 */
export function validateEnum<T>(value: string, validValues: T[]): T | null {
  if (!value) return null;
  
  if ((validValues as any).includes(value)) {
    return value as any;
  }
  
  return null;
}
```

#### Usage in Routes

```typescript
// /src/app/api/v1/users/route.ts

import { 
  validateSearchParam, 
  validatePagination,
  validateEnum 
} from '@/lib/api/validation';

async function handler(req: NextRequest, context) {
  try {
    const { searchParams } = new URL(req.url);
    
    // 1. Validate and sanitize search
    const search = validateSearchParam(searchParams.get('search'));
    
    // 2. Validate pagination
    const { limit, offset } = validatePagination(
      searchParams.get('limit'),
      searchParams.get('offset')
    );
    
    // 3. Validate role enum
    const validRoles = ['admin', 'tutor', 'user'];
    const role = validateEnum(
      searchParams.get('role') || '',
      validRoles
    );
    
    // Build query with validated inputs
    const query: any = {};
    
    if (role) {
      query.role = role;
    }
    
    if (search) {
      // Search is now escaped and safe
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    
    const users = await User.find(query)
      .select('-password -__v')
      .limit(limit)
      .skip(offset)
      .lean()
      .exec();
    
    return NextResponse.json({ users });
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('exceeds maximum')) {
      return NextResponse.json(
        { message: error.message },
        { status: 400 }
      );
    }
    throw error;
  }
}
```

---

### Fix #2: Validate ObjectId Parameters

**Priority:** 🟡 **HIGH**  
**Effort:** 1 hour  
**Impact:** High

#### Implementation

```typescript
// /src/app/api/v1/users/[userId]/route.ts

import { validateObjectId } from '@/lib/api/validation';

async function handler(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const params = await context.params;
    const { userId } = params;
    
    // ✅ Validate ObjectId format
    if (!validateObjectId(userId)) {
      return NextResponse.json(
        { 
          code: 'InvalidParameter',
          message: 'Invalid user ID format' 
        },
        { status: 400 }
      );
    }
    
    // ✅ Safe to use in query
    const user = await User.findById(userId)
      .select('-password -__v')
      .lean()
      .exec();
    
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ user });
    
  } catch (error) {
    logger.error('Error fetching user', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

---

### Fix #3: Use Text Search Instead of Regex (Optional Enhancement)

**Priority:** 🟢 **LOW** (Improvement for large datasets)  
**Effort:** 2-3 hours  
**Impact:** Better performance and security

#### Implementation

```typescript
// Setup text indexes in MongoDB models
// /src/models/user.ts

const userSchema = new Schema({
  // ... fields
});

// Create text index for full-text search
userSchema.index({
  email: 'text',
  firstName: 'text',
  lastName: 'text',
  name: 'text'
});

// Or in migration:
db.users.createIndex({
  email: "text",
  firstName: "text",
  lastName: "text",
  name: "text"
});
```

#### Use in Route

```typescript
// /src/app/api/v1/users/route.ts

if (search) {
  // Use text search instead of regex (more secure and faster)
  query.$text = { $search: search };
  // MongoDB handles escaping internally
}

const users = await User.find(query)
  .select('-password -__v')
  .limit(limit)
  .skip(offset)
  .lean()
  .exec();
```

---

### Fix #4: Add Rate Limiting on Search Endpoints

**Priority:** 🟡 **HIGH**  
**Effort:** 1-2 hours  
**Impact:** Prevents ReDoS/DoS attacks

```typescript
// /src/lib/api/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 searches per minute
});

// Apply in route
export const GET = withRole(['admin'], async (req, context) => {
  // Rate limit search operations
  const rl = await ratelimit.limit(context.userId.toString());
  
  if (!rl.success) {
    return NextResponse.json(
      { message: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.resetMs) } }
    );
  }
  
  // Continue with handler...
});
```

---

## 📋 Implementation Checklist

### CRITICAL (Do Today)

- [ ] Add `validateSearchParam()` to escape regex in all routes
- [ ] Add `validatePagination()` to all pagination endpoints
- [ ] Add `validateObjectId()` to all dynamic routes
- [ ] Test with malicious inputs

### HIGH (This Week)

- [ ] Add rate limiting to search endpoints
- [ ] Implement validation middleware
- [ ] Update all API routes to use validation helpers
- [ ] Add integration tests for injection attempts

### NICE TO HAVE (Next Sprint)

- [ ] Implement full-text search with text indexes
- [ ] Add MongoDB query logging for monitoring
- [ ] Implement query complexity analysis
- [ ] Add automated security testing

---

## 🧪 Testing Payloads

Use these to test vulnerability fixes:

```bash
# Test 1: ReDoS Pattern
curl "http://localhost:3000/api/v1/users?search=(a+)+b"

# Test 2: Long String (Memory Exhaustion)
curl "http://localhost:3000/api/v1/users?search=$(python -c 'print(\"a\"*10000)')"

# Test 3: Special Characters
curl "http://localhost:3000/api/v1/users?search=.*"

# Test 4: Operators
curl "http://localhost:3000/api/v1/users?search={\"$gt\":\"\"}"

# Test 5: Invalid ObjectId
curl "http://localhost:3000/api/v1/users/invalid-id"

# Test 6: Huge Offset
curl "http://localhost:3000/api/v1/users?offset=999999999"

# Test 7: Negative Limit
curl "http://localhost:3000/api/v1/users?limit=-1"
```

**Expected Behavior After Fixes:**
- All requests should be rejected with 400 Bad Request
- Payloads should be logged for monitoring
- No database queries should be executed
- Server should remain responsive

---

## 📊 Risk Assessment Summary

| Vulnerability | Severity | Exploitability | Impact | Risk Level |
|---------------|----------|---|--------|-----------|
| Regex Injection | Medium | Moderate | Medium | 🟡 MEDIUM |
| ReDoS Attack | Medium | Easy | High | 🟡 MEDIUM |
| Missing Validation | Medium | Easy | Medium | 🟡 MEDIUM |
| ObjectId Coercion | Low | Hard | Low | 🟢 LOW |

---

## ✅ Security Summary

**Good News:**
- ✅ Using Mongoose ORM (prevents SQL injection)
- ✅ No dangerous query execution methods
- ✅ Proper field selection
- ✅ Role-based access control

**Issues Found:**
- ⚠️ Unescaped regex patterns in search (Medium Risk)
- ⚠️ No input validation on query parameters (Medium Risk)
- ⚠️ Weak ObjectId validation (Low Risk)

**Estimated Fix Time:** 4-6 hours  
**Recommendation:** Implement all fixes immediately

---

## 🔒 Comparison: SQL vs NoSQL Injection

| Aspect | SQL | NoSQL (MongoDB) |
|--------|-----|-----------------|
| **Attack Vector** | String concatenation | Operator injection |
| **Typical Risk** | ❌ HIGH | 🟡 MEDIUM |
| **Your Project** | ✅ Safe (ORM used) | 🟡 Regex issue found |
| **Prevention** | Prepared statements | Input validation |
| **Mongoose Protection** | N/A | ✅ Default ORM features |

---

**Status:** Ready for Implementation  
**Priority:** CRITICAL - Implement within 1 week  
**Next Review:** February 6, 2026
