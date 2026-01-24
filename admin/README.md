# PLYSHIP Admin Panel Access Guide

## 🎯 How to Access the Admin Panel

The admin panel is a web-based dashboard that can be accessed from any browser on your computer/laptop.

### Option 1: Through Preview URL (Recommended)

Since you're running this in a cloud environment, use your preview URL with `/admin` path:

**Example:**
```
https://your-preview-url.emergentagent.com/api/../admin/
```

Or simply replace the port in your browser:
```
https://interiorlink-2.preview.emergentagent.com:8001/admin/
```

### Option 2: Direct Backend Access

If you have direct access to the backend:
```
http://your-backend-host:8001/admin/
```

## 🔐 Login Credentials

**Username:** `admin`  
**Password:** `admin123`

## ✅ Features Available

### Dashboard
- View real-time statistics
- Total users, seekers, companies
- Matches, appointments, transactions
- Active disputes
- Total wallet balance

### User Management
- View all users
- Search and filter by role
- View user details
- Ban users
- Delete users

### Appointments
- View all appointments
- Search and filter by status
- Cancel appointments
- View appointment details

### Transactions
- Monitor all transactions
- Search and filter by type
- View transaction history
- Track wallet balances

### Disputes
- View confirmation mismatches
- Approve or reject disputed meetings
- Manually process ₹500 transfers

### Analytics
- Match rate
- Meeting confirmation rate
- Average transaction value
- Total revenue

## 🔧 Troubleshooting

### Admin Panel Not Loading?

1. **Check Backend is Running:**
   ```bash
   curl http://localhost:8001/docs
   ```
   Should return the API documentation page.

2. **Verify Admin Files:**
   ```bash
   ls /app/admin/
   ```
   Should show: `index.html`, `styles.css`, `app.js`

3. **Test Admin Endpoint:**
   ```bash
   curl http://localhost:8001/admin/
   ```
   Should return the HTML content.

4. **Clear Browser Cache:**
   - Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)
   - Or open in Incognito/Private mode

### Logout Button Not Working?

- Click logout, confirm the dialog
- Page will refresh and show login screen
- If stuck, clear browser localStorage:
  - Open DevTools (F12)
  - Go to Application > Local Storage
  - Delete `admin_token`
  - Refresh page

## 📱 Accessing from Your Computer

Since the backend runs on port 8001, you'll need to access it through your preview/proxy URL. The exact URL depends on your deployment setup.

**Note:** `localhost:8001` only works if you're running the browser on the same machine as the backend. For cloud deployments, use the preview URL with the `/admin` path.

## 🎨 UI Features

- Clean, modern dashboard
- Color-coded status badges
- Real-time data updates
- Search and filter capabilities
- Responsive design
- Intuitive navigation

## 💡 Tips

1. Use the **Refresh button** (🔄) to reload data
2. **Search bars** support partial matches
3. **Filters** can be combined with search
4. All actions require confirmation
5. Data updates in real-time

---

**Need Help?** Check the backend logs for any errors:
```bash
tail -50 /var/log/supervisor/backend.out.log
```
