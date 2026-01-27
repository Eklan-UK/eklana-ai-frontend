# Component API Documentation

## PronunciationAnalyticsComponent

**Location:** `/src/components/admin/pronunciation-analytics.tsx`

### Props

```typescript
interface PronunciationAnalyticsComponentProps {
  learnerId: string;           // Required: User ID to fetch analytics for
  learnerName?: string;        // Optional: Display name (defaults to 'Learner')
}
```

### Usage

```tsx
import { PronunciationAnalyticsComponent } from '@/components/admin/pronunciation-analytics';

export function LearnerProfile() {
  return (
    <PronunciationAnalyticsComponent 
      learnerId="507f1f77bcf86cd799439011"
      learnerName="John Doe"
    />
  );
}
```

### Features

#### Overall Statistics
- Total words practiced
- Passed words count with completion rate
- Average pronunciation accuracy score
- Count of challenging words
- Overall pass rate percentage

#### Problem Areas Section
- **Difficult Sounds:** Phonemes with low scores (IPA notation)
  - Shows frequency count of errors
  - Color-coded (orange) for visibility
  
- **Difficult Letters:** Letters mispronounced
  - Shows frequency count of errors
  - Color-coded (red) for visibility

#### Word-Level Progress
- **Filterable list** of all practiced words
  - Filter buttons: All | Passed | Challenging
  - Shows word count in each category
  
- **Card layout** for each word with:
  - Word title and definition (if available)
  - Status indicator (✓ completed, ⚠ challenging, ✗ pending)
  - Quick stats (attempts, best score, average score)
  - Clickable to expand details

- **Expanded details** include:
  - Challenge level (low/medium/high)
  - Last attempt date
  - Date when word was passed (if applicable)
  - Current status
  - Weak phonemes (if any)
  - Incorrectly pronounced letters (if any)

#### Performance Summary
Three summary cards:
1. **Completed** - Number and % of words passed
2. **Average Performance** - Mean accuracy with feedback
3. **Challenging Words** - Count with focus recommendation

### States

#### Loading
```tsx
<div className="flex items-center justify-center py-12">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
</div>
```

#### Error
```tsx
<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
  <p className="text-red-700 text-sm">Failed to load pronunciation analytics</p>
</div>
```

#### Empty State
```tsx
<div className="text-center py-12 text-gray-500">
  <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
  <p>No pronunciation data available yet</p>
</div>
```

### Data Structure Expected

```typescript
{
  overall: {
    totalAssignments: number;
    completedAssignments: number;
    inProgressAssignments: number;
    pendingAssignments: number;
    averageScore: number;      // 0-100
    passRate: number;          // 0-100
  };
  
  problemAreas: {
    topIncorrectLetters: Array<{
      letter: string;
      count: number;
    }>;
    topIncorrectPhonemes: Array<{
      phoneme: string;
      count: number;
    }>;
  };
  
  wordStats: Array<{
    _id: string;
    title: string;
    word: string;
    text?: string;
    attempts: number;
    bestScore: number;         // 0-100
    averageScore: number;      // 0-100
    status: 'completed' | 'pending' | 'in-progress';
    isChallenging: boolean;
    challengeLevel?: 'low' | 'medium' | 'high';
    weakPhonemes: string[];
    incorrectLetters: string[];
    lastAttemptAt?: Date;
    passedAt?: Date;
  }>;
}
```

### Hooks Used

```typescript
// From usePronunciations hook
const { data: analytics, isLoading, error } = useLearnerPronunciationAnalytics(learnerId);
```

### Styling

All Tailwind CSS with:
- Responsive grid layouts
- Color-coded metrics (green/yellow/purple/orange/red)
- Smooth transitions and hover effects
- Mobile-first responsive design

---

## DrillSubmissionsComponent

**Location:** `/src/components/admin/drill-submissions.tsx`

### Props

```typescript
interface DrillSubmissionsComponentProps {
  learnerId: string;           // Required: User ID to fetch drills for
  learnerName?: string;        // Optional: Display name (defaults to 'Learner')
}
```

### Usage

```tsx
import { DrillSubmissionsComponent } from '@/components/admin/drill-submissions';

export function LearnerProfile() {
  return (
    <DrillSubmissionsComponent 
      learnerId="507f1f77bcf86cd799439011"
      learnerName="John Doe"
    />
  );
}
```

### Features

#### Overview Cards (5 Metrics)
1. **Total Drills** - Count of all assigned drills
2. **Pending** - Not yet started count
3. **In Progress** - Currently working count
4. **Completed** - Finished count
5. **Pending Review** - Awaiting tutor/admin review

#### Filter Tabs
Dynamic tabs based on data:
- **All** - Shows all drills
- **Pending** - Only not-started drills
- **In Progress** - Only currently-working drills
- **Completed** - Only finished drills
- **For Review** - Only pending-review submissions (if count > 0)

Tab shows count in parentheses: `All (12)`

#### Performance Summary (when drills completed)
Two cards:
1. **Completion Rate**
   - Percentage with progress bar
   - Number of completed vs. total
   - Visual feedback on progress
   
2. **Average Score**
   - Mean score across drills
   - Performance feedback message
   - Emoji indicators for performance level

#### Drill List (Expandable)
Each drill card shows:
- **Drill type icon** (📚 🎤 ✏️ 🔗 📖 🎭 📝 📄)
- **Drill title** (truncated if long)
- **Type and difficulty** (small text)
- **Status badges** with icons
- **Review pending indicator** (if applicable)
- **Score** (right-aligned, color-coded)

Click to expand and see:
- Assignment date
- Due date
- Start date (if started)
- Completion date (if completed)
- Time spent (in minutes)
- Type-specific results:
  - **Vocabulary:** Number of words
  - **Grammar:** Accuracy & review status
  - **Matching:** Pairs matched / total
  - **Definition:** Accuracy
  - **Sentence Writing:** Sentences written / total
  - **Roleplay:** Scene scores
  - **Summary:** Completion status

#### Review Status Indicator
If `requiresReview === true`:
```
⚠️ Awaiting Review
This drill submission requires tutor or admin review
```

### States

#### Loading
```tsx
<div className="flex items-center justify-center py-12">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
</div>
```

#### Error
```tsx
<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
  <p className="text-red-700 text-sm">Failed to load drill submissions</p>
</div>
```

#### Empty State
```tsx
<div className="text-center py-12 text-gray-500">
  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
  <p>No drills assigned yet</p>
</div>
```

### Status Badges

#### Pending
```
⏱️ Pending
```
(Gray background)

#### In Progress
```
⚡ In Progress
```
(Blue background)

#### Completed
```
✓ Completed
```
(Green background)

#### Pending Review
```
⚠️ Review Pending
```
(Orange background)

### Data Structure Expected

```typescript
Array<{
  _id: string;
  drill?: {
    _id: string;
    title: string;
    type: 'vocabulary' | 'grammar' | 'pronunciation' | 'roleplay' | 'sentence-writing' | 'matching' | 'definition' | 'summary';
    difficulty: 'easy' | 'medium' | 'hard';
  };
  title?: string;              // Fallback if no drill object
  type?: string;               // Fallback if no drill object
  difficulty?: string;         // Fallback if no drill object
  
  assignmentId?: string;
  assignedBy?: string;
  assignedAt?: Date;
  dueDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'skipped';
  completedAt?: Date;
  
  latestAttempt?: {
    score?: number;            // 0-100
    startedAt?: Date;
    completedAt?: Date;
    timeSpent?: number;        // Seconds
    
    // Type-specific results
    vocabularyResults?: {
      wordScores: Array<{
        word: string;
        score: number;
        attempts: number;
      }>;
    };
    
    grammarResults?: {
      accuracy?: number;
      patternScores?: Array<any>;
      reviewStatus?: 'pending' | 'reviewed';
    };
    
    matchingResults?: {
      pairsMatched: number;
      totalPairs: number;
      accuracy: number;
    };
    
    definitionResults?: {
      wordsDefined: number;
      totalWords: number;
      accuracy: number;
    };
    
    sentenceWritingResults?: {
      sentencesWritten: number;
      totalSentences: number;
      accuracy: number;
    };
    
    roleplayResults?: {
      sceneScores: Array<{
        sceneName: string;
        score: number;
      }>;
    };
  };
  
  requiresReview?: boolean;
  reviewStatus?: 'pending' | 'reviewed';
}>
```

### Hooks Used

```typescript
// From useAdmin hook or useDrills
const { data: drills = [], isLoading, error } = useLearnerDrills(learnerId, learnerEmail);
```

### Drill Type Icons

```
📚 Vocabulary
✏️ Grammar
🎤 Pronunciation
🎭 Roleplay
📝 Sentence Writing
🔗 Matching
📖 Definition
📄 Summary
📌 Unknown type (default)
```

### Styling

All Tailwind CSS with:
- Responsive grid layouts
- Color-coded statuses and scores
- Smooth transitions and animations
- Mobile-first responsive design
- Emoji icons for visual clarity

### Color Coding Rules

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Score | ≥ 70 | 50-69 | < 50 |
| Status | Completed | In Progress | Pending |
| Accuracy | ≥ 80% | 50-79% | < 50% |

---

## Integration Example

### Using Both Components

```tsx
import { PronunciationAnalyticsComponent } from '@/components/admin/pronunciation-analytics';
import { DrillSubmissionsComponent } from '@/components/admin/drill-submissions';

export function LearnerProfile({ learnerId }: { learnerId: string }) {
  const learnerName = 'John Doe';
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{learnerName} - Progress Overview</h1>
      
      <section>
        <h2 className="text-2xl font-bold mb-4">Drill Performance</h2>
        <DrillSubmissionsComponent 
          learnerId={learnerId} 
          learnerName={learnerName}
        />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold mb-4">Pronunciation Progress</h2>
        <PronunciationAnalyticsComponent 
          learnerId={learnerId}
          learnerName={learnerName}
        />
      </section>
    </div>
  );
}
```

---

## Error Handling

Both components handle:
- ✅ API fetch failures
- ✅ Missing data (empty arrays)
- ✅ Network timeouts
- ✅ Invalid data structures
- ✅ Loading states
- ✅ Component unmounting during fetch

---

## Performance Considerations

### Optimization Techniques Used

1. **React Query Caching** (2-minute stale time)
2. **Lazy Component Loading** (on-demand)
3. **Expandable Lists** (only one expanded at a time)
4. **Client-side Filtering** (no re-fetch)
5. **Memoized Calculations** (score colors, challenge levels)
6. **Limited Data Fetch** (pagination in API)

### Performance Tips

- Avoid fetching data on every render
- Use React Query's `staleTime` to reduce API calls
- Filter on client side when possible
- Limit expandable items to reasonable size
- Use pagination for large drill/word lists

---

## Accessibility

Both components include:
- ✅ Semantic HTML
- ✅ Proper heading hierarchy
- ✅ Color not sole means of communication (icons + color)
- ✅ Responsive text sizing
- ✅ Clickable areas properly sized (≥44px minimum)
- ✅ Clear feedback on interactions

---

## Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

---

## Responsive Design

### Breakpoints Used

- **Mobile:** < 640px (single column)
- **Tablet:** 640px - 1024px (2 columns)
- **Desktop:** > 1024px (4+ columns)

### Layout Adjustments

- Overview cards: 2 cols (mobile) → 5 cols (desktop)
- Statistics: 1 col (mobile) → 3 cols (desktop)
- Problem areas: 1 col (mobile) → 2 cols (desktop)
- Word/drill cards: Full width (all sizes)

---

## Testing

### Unit Testing Example

```tsx
import { render, screen } from '@testing-library/react';
import { PronunciationAnalyticsComponent } from '@/components/admin/pronunciation-analytics';

describe('PronunciationAnalyticsComponent', () => {
  it('renders loading state', () => {
    render(<PronunciationAnalyticsComponent learnerId="test-id" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  
  it('displays overall statistics', async () => {
    render(<PronunciationAnalyticsComponent learnerId="test-id" />);
    await screen.findByText(/Total Words/i);
    expect(screen.getByText(/Total Words/i)).toBeInTheDocument();
  });
});
```

---

## Migration from Old Component

If migrating from old implementation:

1. Remove old drills section
2. Add new `DrillSubmissionsComponent`
3. Update old pronunciation analytics with new `PronunciationAnalyticsComponent`
4. Test data loading
5. Verify styling matches design
6. Test on mobile devices

---

## Common Issues & Solutions

### Issue: No data displays
**Solution:** Verify `learnerId` is valid and data exists in database

### Issue: Loading spinner infinite
**Solution:** Check network tab for API errors, verify endpoint exists

### Issue: Styling looks wrong
**Solution:** Ensure Tailwind CSS is properly configured, check for CSS conflicts

### Issue: Component unmounts on navigation
**Solution:** Use React Query's `keepPreviousData` option to preserve state

---

## Support

For issues or questions:
1. Check `/PRONUNCIATION_AND_LEARNER_ANALYTICS_GUIDE.md` for detailed documentation
2. Review data structure expectations above
3. Check browser console for errors
4. Verify API endpoints are responding correctly
5. Ensure all required hooks are imported and used

---

## Version

- **Created:** January 22, 2026
- **Status:** Production Ready ✅
- **Last Updated:** January 22, 2026
