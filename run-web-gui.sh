#!/bin/bash
# Spanish Tutor Web GUI Launcher
# 
# This script starts the Spanish Tutor Web GUI
# Make sure Ollama is running before starting the web interface

echo "🎓 Starting Spanish Tutor Web GUI..."
echo ""
echo "Prerequisites:"
echo "- Ollama should be running (ollama serve)"
echo "- Python dependencies should be installed"
echo ""

# Check if we're in the right directory
if [ ! -f "web_gui/app.py" ]; then
    echo "❌ Error: web_gui/app.py not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if requirements are installed
if ! python -c "import flask" 2>/dev/null; then
    echo "📦 Installing web requirements..."
    pip install -r requirements-web.txt
fi

echo "🚀 Starting web server..."
echo "📱 Open your browser to: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Change to web_gui directory and start the Flask app
cd web_gui && python app.py