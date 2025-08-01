#!/bin/bash
# Run Spanish Tutor in Production Mode

echo "🏭 Starting Spanish Tutor Production Environment..."
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

echo "🔨 Building React production build..."
(cd frontend && npm run build)

if [ $? -ne 0 ]; then
    echo "❌ React build failed"
    exit 1
fi

echo "✅ React build completed"
echo ""

echo "🚀 Starting Flask production server (port 8080)..."
echo ""
echo "🌐 Application will be available at:"
echo "   Production Server: http://localhost:8080"
echo ""
echo "💡 This serves both the React app and API endpoints"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping production server..."
    echo "✅ Server stopped"
    exit
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start Flask server
cd web_gui && python app.py