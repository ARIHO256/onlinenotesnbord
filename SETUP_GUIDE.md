# Setup Guide - Bugema University Notice Board

## 🚀 Quick Start

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment** (if not already done)
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Linux/Mac
   # or
   .venv\Scripts\activate  # On Windows
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations**
   ```bash
   python3 manage.py makemigrations
   python3 manage.py migrate
   ```

5. **Create superuser** (if needed)
   ```bash
   python3 manage.py createsuperuser
   ```

6. **Start server**
   ```bash
   python3 manage.py runserver 0.0.0.0:8000
   ```

### Mobile App Setup

1. **Navigate to mobile directory**
   ```bash
   cd mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start Expo**
   ```bash
   npm run start
   ```

4. **Configure API URL** (if needed)
   - Set `EXPO_PUBLIC_API_URL` environment variable
   - Default: `http://10.0.2.2:8000` (Android emulator)
   - For physical device: Use your computer's IP address

## ✨ New Features to Test

### 1. Priority System
- Create a notice and select priority (Urgent/Important/Normal)
- Urgent notices appear first with red badges
- Important notices have yellow badges

### 2. Expiration Dates
- Set expiration date when creating notice
- See "Expires in X days" badge on notice cards
- Expired notices are automatically hidden

### 3. Department Following
- Go to Profile → Preferences
- Follow additional departments
- Filter notices by department on home screen

### 4. Notice Templates
- Create notice → Select template from dropdown
- Templates auto-fill title, description, category, priority
- Create your own templates (saved as drafts)

### 5. Notification Preferences
- Go to Profile → Preferences
- Configure notification settings
- Set quiet hours, category preferences

### 6. Analytics Dashboard
- Staff users: Go to Profile → Analytics Dashboard
- View comprehensive statistics
- See engagement metrics and distributions

### 7. Enhanced Search
- Tap Search tab
- Use filter icon to show priority filters
- Filter search results by priority level

## 🔧 Troubleshooting

### Migration Issues
If migrations fail:
```bash
python3 manage.py makemigrations notices
python3 manage.py makemigrations users
python3 manage.py migrate
```

### API Connection Issues
- Check backend server is running
- Verify API URL in mobile app
- Check firewall settings
- For physical device: Use computer's IP instead of localhost

### Template Issues
- Templates are optional - app works without them
- Create templates via admin panel or API
- Public templates are visible to all users

## 📝 Notes

- All new features are backward compatible
- Existing notices will have "normal" priority by default
- Expiration is optional - notices without expiration never expire
- Department following is optional - users see their department by default

## 🎯 Testing Checklist

- [ ] Create notice with priority
- [ ] Set expiration date on notice
- [ ] Follow/unfollow departments
- [ ] Use template to create notice
- [ ] Configure notification preferences
- [ ] View analytics dashboard (as staff)
- [ ] Search with priority filter
- [ ] Verify expired notices are hidden
- [ ] Check priority sorting (urgent first)

---

**Ready to use!** All features are implemented and ready for testing.

