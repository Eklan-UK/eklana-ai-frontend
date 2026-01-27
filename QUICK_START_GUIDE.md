# Quick Start Guide - Learner Analytics Dashboard

**Last Updated:** January 22, 2026

---

## 🚀 5-Minute Setup

### What You Get

✅ **PronunciationAnalyticsComponent** - Shows learner pronunciation progress  
✅ **DrillSubmissionsComponent** - Shows drill assignments and submissions  
✅ **Updated Learner Profile Page** - Integrated at `/admin/learners/[id]`

### Pre-requisites

- Learner data in database with pronunciation attempts and drill assignments
- API endpoints responding correctly
- React Query configured (already done in project)

### How It Works

```
Admin visits: /admin/learners/[learnerId]
         ↓
Components load automatically
         ↓
Fetch analytics from API
         ↓
Display metrics, charts, lists
         ↓
Admin reviews learner progress
```

---

## 📍 Where Components Are Used

### File Structure

```
src/
├── components/
│   └── admin/
│       ├── pronunciation-analytics.tsx    ← Pronunciation component
│       └── drill-submissions.tsx          ← Drill submissions component
└── app/
    ├── (admin)/
    │   └── admin/
    │       └── learners/
    │           └── [id]/
    │               └── page.tsx           ← Updated learner page
```

### Integration Point

The components are imported and used in `/src/app/(admin)/admin/learners/[id]/page.tsx`:

```tsx
import { PronunciationAnalyticsComponent } from '@/components/admin/pronunciation-analytics';
import { DrillSubmissionsComponent } from '@/components/admin/drill-submissions';

// In the page component:
<DrillSubmissionsComponent learnerId={learnerId} learnerName={name} />
<PronunciationAnalyticsComponent learnerId={learnerId} learnerName={name} />
```

---

## 🎯 Using the Components

### Option 1: Use in Learner Page (Already Done!)

The learner page now has both components integrated.

**Access:** `/admin/learners/[learnerId]`

```
Admin Profile Info
├── Profile Information (name, email, status)
├── Drills & Submissions (NEW)
│   └── DrillSubmissionsComponent
└── Pronunciation Analytics (NEW)
    └── PronunciationAnalyticsComponent
```

### Option 2: Use Separately in Other Pages

```tsx
import { PronunciationAnalyticsComponent } from '@/components/admin/pronunciation-analytics';

export function MyCustomPage({ learnerId }: { learnerId: string }) {
  return (
    <div className="p-6">
      <h1>Pronunciation Progress</h1>
      <PronunciationAnalyticsComponent learnerId={learnerId} />
    </div>
  );
}
```

---

## 📊 What Each Component Shows

### PronunciationAnalyticsComponent

Displays pronunciation practice analytics:

**At a Glance:**
- Total words practiced
- Words passed (%)
- Average accuracy score
- Challenging words count
- Pass rate (%)

**Details:**
- Difficult sounds (phonemes)
- Difficult letters
- Word-by-word progress
- Expandable cards with attempt history

**Filters:**
- All words
- Passed words
- Challenging words

### DrillSubmissionsComponent

Displays drill assignment tracking:

**At a Glance:**
- Total drills assigned
- Drills by status (pending, in-progress, completed)
- Pending review count

**Performance:**
- Completion rate (%)
- Average score (%)

**Details:**
- Drill-by-drill list
- Status indicators
- Scores with color coding
- Type-specific results
- Review pending indicators

**Filters:**
- All drills
- Pending
- In Progress
- Completed
- For Review (if any)

---

## 🔍 Data Requirements

### For Pronunciation Analytics

The learner needs:
- ✅ Pronunciation attempts recorded
- ✅ Speechace evaluation scores
- ✅ Word progress tracking
- ✅ Accuracy scores

### For Drill Submissions

The learner needs:
- ✅ Drill assignments
- ✅ Attempt records
- ✅ Performance scores
- ✅ Status tracking

### If No Data Shows

1. **Empty state displays** instead of error
2. Helpful messages like "No drills assigned yet"
3. Components still render properly

---

## 🎨 Customization

### Change Learner Name Display

```tsx
<PronunciationAnalyticsComponent 
  learnerId={learnerId}
  learnerName="Custom Name"  // ← Change here
/>
```

### Change Colors

Edit Tailwind classes in component files:
- Green success: `bg-green-50`, `text-green-600`
- Red warning: `bg-red-50`, `text-red-600`
- Blue info: `bg-blue-50`, `text-blue-600`

### Add New Metric

1. Add to API response
2. Add card in component:
   ```tsx
   <div className="p-4 bg-blue-50 rounded-lg">
     <p className="text-xs text-gray-600 mb-1">Label</p>
     <p className="text-2xl font-bold text-blue-600">{value}</p>
   </div>
   ```

---

## 🧪 Testing

### Quick Test

1. Navigate to `/admin/learners/[any-learner-id]`
2. Scroll down to see new components
3. Components should load and display data
4. Click expand on words/drills to see details
5. Click filter tabs to change view

### Verify Data Loads

Open browser DevTools → Network tab:
- Should see requests to `/api/v1/pronunciations/learner/[id]/analytics`
- Should see requests to `/api/v1/drills/learner/my-drills`
- Both should return status 200 with data

### Test Empty States

Find a learner with no data:
- Component shows "No pronunciation data available"
- Component shows "No drills assigned yet"
- No errors in console

---

## 🐛 Troubleshooting

### Issue: Components don't show

**Check:**
1. Are you on `/admin/learners/[id]` page?
2. Is learnerId valid?
3. Are there any console errors?
4. Does the learner have any data?

**Fix:**
1. Check browser console for errors
2. Verify API endpoints in Network tab
3. Ensure learner has assignments/attempts

### Issue: Data doesn't load

**Check:**
1. Network tab - API requests returning 200?
2. Response data has correct structure?
3. Learner email passed correctly to drills hook?

**Fix:**
1. Check API endpoint is working
2. Verify database has data
3. Try refreshing page

### Issue: Styling looks wrong

**Check:**
1. Tailwind CSS loaded?
2. No CSS conflicts?
3. Browser zoom at 100%?

**Fix:**
1. Clear browser cache
2. Check for CSS conflicts
3. Verify Tailwind config

---

## 📚 Documentation Files

| Document | Purpose |
|----------|---------|
| `PRONUNCIATION_AND_LEARNER_ANALYTICS_GUIDE.md` | Complete technical guide |
| `COMPONENT_API_REFERENCE.md` | Component props & usage |
| `LEARNER_ANALYTICS_IMPLEMENTATION_SUMMARY.md` | What was implemented |
| `PUSH_NOTIFICATION_IMPLEMENTATION_ANALYSIS.md` | Push notifications (separate feature) |

---

## 🎓 Common Tasks

### View Learner Pronunciation Progress

1. Go to `/admin/learners/[learnerId]`
2. Scroll to "Pronunciation Analytics" section
3. See overall stats (words, score, pass rate)
4. Scroll down to see difficult sounds/letters
5. Click a word to see detailed progress
6. Filter by "Challenging" to see problem words

### Check Pending Drill Reviews

1. Go to `/admin/learners/[learnerId]`
2. Scroll to "Drills & Submissions" section
3. Click "For Review" tab (if count > 0)
4. See all submissions pending approval
5. Click to expand for details

### Monitor Drill Completion

1. Go to `/admin/learners/[learnerId]`
2. See completion rate with progress bar
3. Check average score
4. Filter by status to see breakdown
5. Identify overdue drills (if any)

### Identify Learning Challenges

1. Go to "Pronunciation Analytics"
2. Look at "Challenging Words" section
3. See "Difficult Sounds" and "Difficult Letters"
4. Click words to see weak phonemes
5. Use this to provide targeted feedback

---

## ✨ Features at a Glance

### Pronunciation Component
- ✅ 5 metric cards with live data
- ✅ Problem area visualization
- ✅ Filterable word list
- ✅ Expandable detail cards
- ✅ Performance summary
- ✅ Empty state handling
- ✅ Loading states
- ✅ Error handling

### Drill Component
- ✅ 5 metric cards
- ✅ 4+ filter tabs
- ✅ Performance summary
- ✅ Expandable drill cards
- ✅ Type-specific results
- ✅ Review status indicators
- ✅ Responsive design
- ✅ Color-coded scores

---

## 🚀 Going Live

### Pre-Launch Checklist

- [ ] Test with real learner data
- [ ] Check all screens (mobile, tablet, desktop)
- [ ] Verify all API endpoints working
- [ ] Test with learners having no data
- [ ] Test with learners having lots of data
- [ ] Check console for errors
- [ ] Verify styling matches design
- [ ] Test all filter tabs
- [ ] Test all expandable items
- [ ] Check loading states
- [ ] Test on different browsers

### Deployment

1. Commit changes to main branch
2. Deploy with next build/deploy process
3. Monitor error logs
4. Get user feedback
5. Iterate based on feedback

---

## 📞 Need Help?

### Check These Files

1. **Setup issue?** → Read this file again
2. **Component usage?** → See `COMPONENT_API_REFERENCE.md`
3. **Data structure?** → See `PRONUNCIATION_AND_LEARNER_ANALYTICS_GUIDE.md`
4. **What was built?** → See `LEARNER_ANALYTICS_IMPLEMENTATION_SUMMARY.md`

### Look In

- Browser console (F12) for error messages
- Network tab for API responses
- React Query DevTools for cache state

### Common Solutions

| Issue | Solution |
|-------|----------|
| No data shows | Learner may not have assignments yet |
| API 404 error | Check endpoint URL and learner ID |
| Styling wrong | Clear cache, check Tailwind config |
| Loading forever | Check Network tab for failed requests |

---

## 🎯 Next Steps

### For Admins Using This

1. Navigate to learner profile page
2. Review pronunciation progress
3. Review drill submissions
4. Identify challenge areas
5. Provide targeted feedback
6. Monitor improvement over time

### For Developers Enhancing This

1. Add new metrics (see customization guide)
2. Change colors (edit Tailwind classes)
3. Add new filters (edit filter button array)
4. Integrate with other systems
5. Create reports/exports

---

## ✅ You're Ready!

The learner analytics dashboard is ready to use. Just navigate to any learner profile and see their complete analytics!

**Happy analyzing! 🚀**
