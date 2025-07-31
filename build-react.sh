#!/bin/bash
# Build React frontend and copy to Flask static directory

echo "🚀 Building React frontend for Spanish Tutor..."

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "web_gui" ]; then
    echo "❌ Error: web_gui directory not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "📦 Installing/updating React dependencies..."
cd frontend && npm install

echo "🔨 Building React application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ React build completed successfully!"
    echo "📁 Built files are available in web_gui/static/dist/"
    echo ""
    echo "🌐 You can now run the Flask server:"
    echo "   ./run-web-gui.sh"
    echo ""
    echo "📡 Or run in development mode with:"
    echo "   cd frontend && npm run dev"
    echo "   (React dev server will be at http://localhost:3000)"
else
    echo "❌ React build failed!"
    exit 1
fi