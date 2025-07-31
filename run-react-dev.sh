#!/bin/bash
# Run React development server with Flask backend

echo "🎓 Starting Spanish Tutor React Development Environment..."
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if requirements are installed
if ! python -c "import flask" 2>/dev/null; then
    echo "📦 Installing web requirements..."
    pip install -r requirements-web.txt
fi

echo "🚀 Starting Flask backend server (port 8080)..."
cd web_gui && python app.py &
FLASK_PID=$!

echo "⚡ Starting React development server (port 3000)..."
cd ../frontend && npm run dev &
REACT_PID=$!

echo ""
echo "🌐 Services started:"
echo "   React Dev Server:  http://localhost:3000"
echo "   Flask API Server:  http://localhost:8080"
echo ""
echo "💡 The React dev server will proxy API calls to Flask automatically"
echo "🛑 Press Ctrl+C to stop both servers"
echo ""

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $FLASK_PID 2>/dev/null
    kill $REACT_PID 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait