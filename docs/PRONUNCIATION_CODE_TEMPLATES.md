# Copy-Paste Code Templates for Pronunciation System

## 1️⃣ Update pronunciationProblemAPI in `/src/lib/api.ts`

Add these methods to the `pronunciationProblemAPI` object (around line 360):

```typescript
// Add these to pronunciationProblemAPI:

  // Update pronunciation problem (admin)
  update: (slug: string, data: {
    title?: string;
    description?: string;
    phonemes?: string[];
    difficulty?: string;
    estimatedTimeMinutes?: number;
    isActive?: boolean;
  }) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: { problem: any };
    }>(`/pronunciation-problems/${slug}`, {
      method: 'PATCH',
      data,
    });
  },

  // Delete pronunciation problem (admin)
  delete: (slug: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
    }>(`/pronunciation-problems/${slug}`, {
      method: 'DELETE',
    });
  },

  // Delete word (admin)
  deleteWord: (wordId: string) => {
    return apiRequest<{
      code?: string;
      message?: string;
    }>(`/pronunciation-words/${wordId}`, {
      method: 'DELETE',
    });
  },

  // Update word (admin)
  updateWord: (wordId: string, data: any) => {
    return apiRequest<{
      code?: string;
      message?: string;
      data?: { word: any };
    }>(`/pronunciation-words/${wordId}`, {
      method: 'PATCH',
      data,
    });
  },
```

---

## 2️⃣ Create Backend Endpoints - Part A

### File: `/src/app/api/v1/pronunciation-problems/[slug]/route.ts`

Update the existing file to add PATCH and DELETE:

```typescript
// Add to the top with other imports:
import { withRole } from '@/lib/api/middleware';

// Add these handlers after the existing getHandler:

// PATCH handler - Update problem
async function patchHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { slug: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { slug } = params;
		const body = await req.json();

		const problem = await PronunciationProblem.findOneAndUpdate(
			{ slug },
			{ ...body, updatedAt: new Date() },
			{ new: true }
		);

		if (!problem) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Problem not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			code: 'Success',
			message: 'Problem updated',
			data: { problem },
		});
	} catch (error: any) {
		logger.error('Error updating problem', error);
		return NextResponse.json(
			{ code: 'ServerError', message: error.message },
			{ status: 500 }
		);
	}
}

// DELETE handler - Delete problem
async function deleteHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { slug: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const { slug } = params;
		await PronunciationProblem.deleteOne({ slug });

		return NextResponse.json({
			code: 'Success',
			message: 'Problem deleted',
		});
	} catch (error: any) {
		logger.error('Error deleting problem', error);
		return NextResponse.json(
			{ code: 'ServerError', message: error.message },
			{ status: 500 }
		);
	}
}

// Update the exports at the bottom:
export const GET = withAuth(getHandler);
export const POST = withRole(['admin'], postHandler);
export const PATCH = withRole(['admin'], patchHandler);
export const DELETE = withRole(['admin'], deleteHandler);
```

---

## 3️⃣ Create Backend Endpoints - Part B

### File: `/src/app/api/v1/pronunciation-words/[wordId]/route.ts` (NEW FILE)

```typescript
// GET, PATCH, DELETE /api/v1/pronunciation-words/[wordId]
import { NextRequest, NextResponse } from 'next/server';
import { withRole, withAuth } from '@/lib/api/middleware';
import { connectToDatabase } from '@/lib/api/db';
import PronunciationWord from '@/models/pronunciation-word';
import { logger } from '@/lib/api/logger';
import { Types } from 'mongoose';

// GET handler
async function getHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { wordId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const word = await PronunciationWord.findById(params.wordId);

		if (!word) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Word not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			code: 'Success',
			data: { word },
		});
	} catch (error: any) {
		logger.error('Error fetching word', error);
		return NextResponse.json(
			{ code: 'ServerError', message: error.message },
			{ status: 500 }
		);
	}
}

// PATCH handler
async function patchHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { wordId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const body = await req.json();
		const word = await PronunciationWord.findByIdAndUpdate(
			params.wordId,
			{ ...body, updatedAt: new Date() },
			{ new: true }
		);

		if (!word) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Word not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			code: 'Success',
			message: 'Word updated',
			data: { word },
		});
	} catch (error: any) {
		logger.error('Error updating word', error);
		return NextResponse.json(
			{ code: 'ServerError', message: error.message },
			{ status: 500 }
		);
	}
}

// DELETE handler
async function deleteHandler(
	req: NextRequest,
	context: { userId: Types.ObjectId; userRole: string },
	params: { wordId: string }
): Promise<NextResponse> {
	try {
		await connectToDatabase();

		const word = await PronunciationWord.findByIdAndDelete(params.wordId);

		if (!word) {
			return NextResponse.json(
				{ code: 'NotFoundError', message: 'Word not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			code: 'Success',
			message: 'Word deleted',
		});
	} catch (error: any) {
		logger.error('Error deleting word', error);
		return NextResponse.json(
			{ code: 'ServerError', message: error.message },
			{ status: 500 }
		);
	}
}

export const GET = withAuth(getHandler);
export const PATCH = withRole(['admin'], patchHandler);
export const DELETE = withRole(['admin'], deleteHandler);
```

---

## 4️⃣ Add Link to Problem Editor

Update `/src/app/(admin)/admin/pronunciation-problems/page.tsx`

Find the problem card rendering (around line 100-150) and add this button:

```typescript
// Inside the problem card, add this after the problem info section:

<Link
  href={`/admin/pronunciation-problems/${problem.slug}`}
  className="w-full mt-4"
>
  <Button className="w-full flex items-center justify-center gap-2">
    <Plus className="w-4 h-4" />
    Manage Words ({problem.wordCount || 0})
  </Button>
</Link>
```

---

## 5️⃣ Quick Test Commands

Test the APIs with curl:

```bash
# Get a problem
curl -X GET http://localhost:3000/api/v1/pronunciation-problems/your-slug-here

# Create attempt (test evaluation)
curl -X POST http://localhost:3000/api/v1/pronunciation-words/[wordId]/attempt \
  -H "Content-Type: application/json" \
  -d '{"audioBase64":"...", "passingThreshold":70}'

# Check if progress was created
curl -X GET http://localhost:3000/api/v1/learner-pronunciation-progress?learnerId=[learnerId]
```

---

## 6️⃣ Database Verification

Check if your data is being stored correctly:

```bash
# SSH into backend and run:
mongo elkan-db

# Check problems:
db.pronunciationproblems.find()

# Check words:
db.pronunciationwords.find()

# Check progress:
db.learnerpronunciationprogresses.find()

# Check attempts:
db.pronunciationattempts.find()
```

---

## 7️⃣ Quick Integration Test

Once you deploy the problem editor page, test this flow:

```
1. Admin logs in
2. Goes to /admin/pronunciation-problems
3. Creates new problem (title: "R vs L", phonemes: ["r", "l"])
4. Clicks "Manage Words" button
5. Should see empty list with "Add Word" button
6. Adds word: "better", IPA: "/ˈbɛtər/", uses TTS
7. Adds word: "letter", IPA: "/ˈlɛtər/", uses TTS
8. Goes back, problem shows "2 words"
9. Switch to learner account
10. Goes to /account/practice/pronunciation
11. Selects problem
12. Should see "better" as first word
13. Records pronunciation
14. Gets scored
15. Marks as passed
16. Should see "letter" next
17. Logs out and back in
18. Returns to same problem
19. Should see "letter" (first uncompleted) - NOT "better"
✅ SUCCESS!
```

---

## 8️⃣ Troubleshooting

### Issue: Add Word button doesn't work
- Check: Is `pronunciationProblemAPI.addWord()` implemented? ✓ Yes
- Check: Is the slug being passed correctly? 
- Check: Is audio file being sent in FormData? ✓ Yes

### Issue: Progress not persisting
- Check: Is word marked as `passed: true`?
- Check: Is learner profile found?
- Check: Is database connection working?

### Issue: Can't find next word
- Check: Database has LearnerPronunciationProgress records
- Check: Try: `db.learnerpronunciationprogresses.findOne({learnerId: "...", passed: false})`

---

## Summary

These templates should get your admin side functional in 2-3 hours:

✅ Update API client
✅ Add backend endpoints  
✅ Add navigation link
✅ Test end-to-end

You still need to implement the UI component (AddPronunciationWord.tsx) which is in PRONUNCIATION_IMPLEMENTATION_GUIDE.md

Good luck! 🚀
