# 🚀 Running the Spanish Tutor Application

## Quick Start Guide

To use the Spanish Tutor application, you need to run **both** the Flask backend and React frontend servers simultaneously.

### 📋 Prerequisites

1. **Backend Dependencies**: `pip install -r requirements-web.txt`
2. **Frontend Dependencies**: `cd frontend && npm install`

### 🔧 Starting the Servers

#### Terminal 1: Flask Backend Server
```bash
# Start the Flask backend on port 8080
python -m web_gui.app
```

#### Terminal 2: React Frontend Server  
```bash
# Start the React frontend on port 3001
cd frontend
npm run dev
```

### 🌐 Access the Application

Once both servers are running:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8080

### 🔐 Test Credentials

You can login with these test credentials:
- **Email**: `testuser@example.com`
- **Password**: `TestPassword123`

### ⚠️ Important Notes

1. **Both servers must be running** - If you see "ECONNREFUSED" errors in Vite, it means the Flask backend is not running
2. **Keep terminals open** - Closing the terminal windows will stop the servers
3. **Port conflicts** - Make sure ports 8080 and 3001 are not in use by other applications

### 🐛 Troubleshooting

**Frontend shows proxy errors?**
- Check that Flask backend is running on port 8080
- Restart the Flask server: `python -m web_gui.app`

**Can't login/register?**
- Verify Flask server is running and responding
- Check backend logs for any error messages
- Try: `curl http://localhost:8080/auth/status`

**Flask server keeps stopping?**
- Check for Python errors in the terminal
- Ensure all dependencies are installed
- Try running with: `python -m web_gui.app` directly in terminal

### 📁 Application Structure

```
├── web_gui/           # Flask backend
│   ├── app.py         # Main Flask application
│   ├── auth.py        # Authentication routes
│   └── models.py      # Database models
├── frontend/          # React frontend
│   ├── src/           # React source code
│   └── package.json   # Frontend dependencies
└── requirements-web.txt # Backend dependencies
```

### 🎯 Next Steps

1. Open two terminal windows
2. Start Flask backend in terminal 1
3. Start React frontend in terminal 2  
4. Navigate to http://localhost:3001
5. Login or register to start using the app!