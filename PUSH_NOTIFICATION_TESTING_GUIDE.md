# Push Notification Testing Guide

## 🎯 Quick Testing Steps

### Prerequisites
- Dev server running: `npm run dev`
- Admin user logged in
- At least one student user created
- Service Worker registered (check `/admin/dashboard`)

---

## Test 1: Drill Assignment Notification ✅

### What to Test
Admin assigns a drill → Student receives push notification

### Steps
1. **Login as Admin**
   - Go to `/admin/drills` or `/admin/drills/assignment`
   
2. **Create or Select a Drill**
   - Click "Create New Drill" or select existing
   - Fill in drill details (title, type, etc.)
   
3. **Assign to Students**
   - Select one or more students
   - Set due date (optional)
   - Click "Assign" or "Save"
   
4. **Switch to Student Account**
   - In another window/incognito, login as student
   - Keep browser window in focus
   
5. **Observe Notification**
   - Should see notification popup: **"New Drill Assigned! 📚"**
   - Body: **"{TutorName} assigned you "{DrillTitle}""**
   - Icon: 📚
   
6. **Click Notification**
   - Should navigate to: `/account/drills/{drillId}`
   - Drill details should be visible

### Troubleshooting
- **No notification?** Check:
  - FCM token registered (check browser console)
  - Service Worker active (DevTools → Application → Service Workers)
  - Server logs show `onDrillAssigned called`
  - Browser notification permission granted

---

## Test 2: Daily Focus Notification ✅

### What to Test
Admin creates daily focus for today → All students receive broadcast

### Steps
1. **Login as Admin**
   - Go to `/admin/daily-focus`
   - Click "Create Daily Focus"
   
2. **Fill in Details**
   - Title: e.g., "Today's Vocabulary Challenge"
   - Focus Type: Select any (grammar, vocabulary, etc.)
   - Practice Format: Select any
   - **Date: Set to TODAY** (This is critical!)
   - Add at least one question
   - Click "Save"
   
3. **Switch to Student Account** (keep multiple students logged in)
   - Open `/account/daily-focus` or `/account/home`
   
4. **Observe Notification**
   - Should see: **"Today's Focus is Ready! 🎯"**
   - Body: **"{FocusTitle}"**
   - Time: Appears immediately after admin creates
   
5. **Test Multiple Students**
   - This is a BROADCAST
   - All active students should receive it
   - Try with 3+ students to verify broadcast works
   
6. **Click Notification**
   - Should navigate to: `/account/daily-focus/{focusId}`

### Key Difference
- **Drill Assignment**: 1 notification per assigned student
- **Daily Focus**: 1 notification to ALL students (broadcast)

### Troubleshooting
- **No broadcast?** Check:
  - Date is TODAY (not tomorrow)
  - isActive flag is checked
  - Multiple students registered in database
  - Server logs show list of userIds

---

## Test 3: Review Submission Notification ✅

### What to Test
Tutor marks student's submission as reviewed → Student gets notification

### Prerequisites
- Student has submitted a drill that requires review
  - Sentence drill
  - Grammar drill
  - Summary drill

### Steps
1. **Student Submits Drill**
   - Login as student
   - Complete any drill that requires review (sentence/grammar/summary)
   - Click "Submit"
   - Should see: "Submission pending review"
   
2. **Login as Tutor/Admin**
   - Go to appropriate review page:
     - Sentence: `/admin/drills/sentence-reviews`
     - Grammar: `/admin/drills/grammar-reviews`
     - Summary: `/admin/drills/summary-reviews`
   
3. **Review the Submission**
   - Find the student's submission
   - Click "Review" button
   - Fill in feedback/corrections
   - Mark as acceptable or provide corrections
   - Click "Submit Review"
   
4. **Switch Back to Student Account**
   - Keep browser in focus
   
5. **Observe Notification**
   - Should see: **"Drill Reviewed! ✅"**
   - Body shows score: **"Your "{DrillTitle}" was reviewed. Score: {score}%"**
   - Or if all correct: **"Great job! All answers correct on "{DrillTitle}" ✨"**
   
6. **Click Notification**
   - Navigate to: `/account/drills/{drillId}/completed?assignmentId={assignmentId}`
   - Should show detailed feedback

### Testing Tips
- Test with different scores (100%, 50%, 0%)
- Test with "all correct" vs "needs improvement"
- Check custom body based on feedback

### Troubleshooting
- **No notification?**
  - Check reviewStatus changed from 'pending' to 'reviewed'
  - Check server logs for `onDrillReviewed called`
  - Verify student has active FCM token
  - Check if notification appeared while tab was background

---

## Test 4: Completion Notification (Tutor Receives) ✅

### What to Test
Student submits drill → Tutor gets notified

### Prerequisites
- Tutor assigned drill to student
- Student has access to that drill

### Steps
1. **Student Completes & Submits**
   - Login as student
   - Go to assigned drill
   - Complete the drill
   - Click "Submit" button
   - See confirmation
   
2. **Login as Tutor** (in another browser window)
   - Go to `/tutor/dashboard` or `/tutor/students`
   - Keep window in focus
   
3. **Observe Notification**
   - Should see: **"Drill Completed 📝"**
   - Body: **"{StudentName} completed "{DrillTitle}" with a score of {score}%"**
   - Time: Appears immediately when student submits
   
4. **Click Notification**
   - Navigate to: `/tutor/students/{studentId}`
   - Should show student details
   - Recent drills section should list the completed drill
   
5. **Verify in Admin Panel**
   - Go to tutor's student list
   - Should see drill marked as "Completed"

### Testing Tips
- Test with different scores
- Test with multiple students submitting
- Verify order of notifications

---

## Console Debugging

### Enable Detailed Logs
Open browser console (F12 → Console tab)

### Check for FCM Messages
```javascript
// You should see in console:
// "=== FCM Message Received ==="
// Full payload object
// "=== Final Notification Object ==="
```

### Check Token Registration
```javascript
// In console:
localStorage.getItem('fcmToken')
// Should return a long token string
```

### Check Service Worker
DevTools → Application → Service Workers
- Should show `firebase-messaging-sw.js` as "Active and running"

---

## Server-Side Debugging

### Check Logs for Notifications Sent
In terminal where dev server is running, grep for:

```bash
# Drill assigned
"onDrillAssigned called"
"Sending drill assignment notifications"

# Daily focus
"Sending daily focus notifications"

# Review submitted
"onDrillReviewed called"
"onDrillReviewed result"

# Drill completed
"Multicast message sent"
"onDrillCompleted"
```

### Check Analytics Logs
Endpoint: `POST /api/v1/fcm/analytics`

Should log with format:
```
[FCM Analytics] notificationId: {id}
- Type: {type}
- Recipients: {count}
- Success Rate: {percent}%
- Timestamp: {time}
```

---

## Expected Behavior Summary

| Scenario | Sender | Recipient | Trigger | Notification |
|----------|--------|-----------|---------|---|
| Drill Assigned | Admin/Tutor | Student | Click "Assign" | "New Drill Assigned! 📚" |
| Daily Focus | Admin | All Students | Save today's focus | "Today's Focus is Ready! 🎯" |
| Review Done | Tutor/Admin | Student | Click "Submit Review" | "Drill Reviewed! ✅" |
| Drill Completed | Student | Tutor | Click "Submit" | "Drill Completed 📝" |

---

## ✅ Verification Checklist

- [ ] Drill Assignment - Notification appears immediately
- [ ] Daily Focus - Broadcasts to all active students
- [ ] Review Submission - Student notified after review
- [ ] Completion - Tutor notified when student submits
- [ ] Deep Links Work - Clicking opens correct screen
- [ ] Score Shows - Completion notification shows score
- [ ] Custom Bodies - Messages vary based on data
- [ ] Background Notifications - Work when tab not focused
- [ ] Multiple Recipients - Broadcast reaches all users
- [ ] Analytics Logged - Notification metrics recorded

---

## 📱 Testing on Mobile (Optional)

### iOS
- Install app from TestFlight/App Store
- Enable notifications in Settings
- Send test notification
- Verify appears in notification center

### Android
- Install APK
- Check notification settings
- Send test notification
- Verify appears in notification center

---

## 🎉 Successful Test Signs

You'll know everything is working when:

1. ✅ **Drill Assignment**: Notification pops up immediately when student is assigned
2. ✅ **Daily Focus**: Multiple students get notification when focus is created for today
3. ✅ **Review Submission**: Notification appears after tutor completes review
4. ✅ **Completion**: Tutor sees notification when student submits
5. ✅ **Deep Links**: Clicking any notification goes to correct screen
6. ✅ **Scores Display**: Completion notifications show actual scores
7. ✅ **Analytics**: Server logs show successful delivery

---

## 💡 Pro Tips

1. **Test in Incognito**: Open one window as admin, another as student in incognito
2. **Keep Browser Focused**: Some notifications only pop when app is in focus
3. **Check Server Logs**: Most issues visible in terminal logs
4. **Clear Cache**: If tests fail, clear browser cache and re-register
5. **Multiple Students**: Test broadcast with 3+ students
6. **Different Scores**: Test reviews with 100%, 50%, 0% to verify custom messages

