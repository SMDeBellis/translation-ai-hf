#!/usr/bin/env python3
"""
Robust Flask server startup script
Keeps the server running with automatic restart on crashes
"""

import os
import sys
import time
import subprocess
import signal
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def start_flask_server():
    """Start the Flask server process"""
    print("🚀 Starting Spanish Tutor Flask Server...")
    
    # Change to project directory
    os.chdir(project_root)
    
    # Start the Flask server
    process = subprocess.Popen([
        sys.executable, "-m", "web_gui.app"
    ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    
    return process

def monitor_server():
    """Monitor and restart Flask server if it crashes"""
    server_process = None
    restart_count = 0
    max_restarts = 5
    
    def signal_handler(signum, frame):
        print(f"\n🛑 Received signal {signum}, shutting down...")
        if server_process:
            server_process.terminate()
            server_process.wait()
        sys.exit(0)
    
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    while restart_count < max_restarts:
        try:
            server_process = start_flask_server()
            print(f"✅ Flask server started with PID: {server_process.pid}")
            print("🌐 Server should be available at: http://localhost:8080")
            print("🔧 Press Ctrl+C to stop the server")
            
            # Monitor the process
            while True:
                output = server_process.stdout.readline()
                if output:
                    print(output.strip())
                
                # Check if process is still running
                if server_process.poll() is not None:
                    print(f"⚠️  Flask server process ended with code: {server_process.returncode}")
                    break
                
                time.sleep(0.1)
            
            # If we get here, the process ended
            restart_count += 1
            if restart_count < max_restarts:
                print(f"🔄 Restarting Flask server (attempt {restart_count + 1}/{max_restarts})...")
                time.sleep(2)
            else:
                print(f"❌ Maximum restart attempts ({max_restarts}) reached. Exiting.")
                
        except Exception as e:
            print(f"❌ Error starting Flask server: {e}")
            restart_count += 1
            if restart_count < max_restarts:
                print(f"🔄 Retrying in 5 seconds... (attempt {restart_count + 1}/{max_restarts})")
                time.sleep(5)

if __name__ == "__main__":
    print("🎓 Spanish Tutor Server Monitor")
    print("=" * 50)
    monitor_server()