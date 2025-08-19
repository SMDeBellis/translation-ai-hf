#!/usr/bin/env python3
"""
Spanish-English Tutoring Chatbot

A conversational Spanish/English tutoring application that uses Ollama for natural language interaction.
The chatbot helps users practice Spanish conversation and provides translation assistance.
"""

import requests
import json
import sys
import os
import re
import glob
from datetime import datetime
from typing import Dict, Optional, List

class SpanishTutorChatbot:
    def __init__(self, ollama_host: str = "localhost:11434", model: str = "llama2", 
                 user_info: Dict = None):
        self.ollama_host = ollama_host
        self.model = model
        self.base_url = f"http://{ollama_host}/api"
        self.conversation_history = []
        self.current_conversation_file = None
        self.session_start_time = datetime.now()
        
        # Set up user-specific paths
        if user_info:
            self.user_id = user_info["user_id"]
            self.conversations_dir = user_info["conversations_dir"]
        else:
            # Fallback to legacy paths for backwards compatibility
            self.user_id = "legacy"
            self.conversations_dir = "conversations"
        
        # Create conversations directory if it doesn't exist
        os.makedirs(self.conversations_dir, exist_ok=True)
        
        # System prompt to establish the chatbot's role
        self.system_prompt = """You are a helpful Spanish-English tutoring chatbot. Your role is to:
1. Help users practice Spanish conversation
2. Provide translations between Spanish and English
3. Explain grammar concepts when asked
4. Correct pronunciation and usage mistakes
5. Encourage learning with positive feedback

Always be patient, encouraging, and educational. When users make mistakes, gently correct them and explain why. 
You can respond in both English and Spanish as appropriate for the learning context.

"""

    def check_ollama_connection(self) -> bool:
        """Check if Ollama is running and accessible."""
        try:
            response = requests.get(f"{self.base_url}/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def build_conversation_context(self, new_message: str) -> str:
        """Build the full conversation context including history."""
        context = self.system_prompt + "\n\n"
        
        # Add conversation history
        for exchange in self.conversation_history:
            context += f"User: {exchange['user']}\n"
            context += f"Assistant: {exchange['bot']}\n\n"
        
        # Add the new message
        context += f"User: {new_message}\n"
        context += "Assistant:"
        
        return context

    def send_message(self, message: str) -> Optional[str]:
        """Send a message to Ollama and get the response with full conversation context."""
        try:
            # Build full conversation context
            full_context = self.build_conversation_context(message)

            payload = {
                "model": self.model,
                "prompt": full_context,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_ctx": 4096  # Increase context window for longer conversations
                }
            }

            response = requests.post(
                f"{self.base_url}/generate",
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                bot_response = result.get("response", "").strip()
                
                # Store conversation history
                exchange = {"user": message, "bot": bot_response, "timestamp": datetime.now().isoformat()}
                self.conversation_history.append(exchange)
                self.save_conversation()
                return bot_response
            else:
                return f"Error: Received status code {response.status_code}"

        except requests.exceptions.RequestException as e:
            return f"Error connecting to Ollama: {str(e)}"


    
    def get_conversation_filename(self, timestamp: datetime = None) -> str:
        """Generate a filename for conversation storage."""
        if timestamp is None:
            timestamp = self.session_start_time
        return f"{self.conversations_dir}/conversation_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"
    
    def save_conversation(self) -> None:
        """Save current conversation to JSON file."""
        if not self.conversation_history:
            return
        
        if self.current_conversation_file is None:
            self.current_conversation_file = self.get_conversation_filename()
        
        conversation_data = {
            "session_start": self.session_start_time.isoformat(),
            "model": self.model,
            "conversation": self.conversation_history
        }
        
        try:
            with open(self.current_conversation_file, "w", encoding="utf-8") as f:
                json.dump(conversation_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️ Could not save conversation: {str(e)}")
    
    def load_latest_conversation(self) -> bool:
        """Load the most recent conversation on startup."""
        try:
            conversation_files = glob.glob(f"{self.conversations_dir}/conversation_*.json")
            if not conversation_files:
                return False
            
            # Get the most recent file
            latest_file = max(conversation_files, key=os.path.getmtime)
            return self.load_conversation(latest_file)
        except Exception as e:
            print(f"⚠️ Could not load latest conversation: {str(e)}")
            return False
    
    def load_conversation(self, filename: str) -> bool:
        """Load a specific conversation from file."""
        try:
            with open(filename, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            self.conversation_history = data.get("conversation", [])
            self.current_conversation_file = filename
            
            # Extract session info
            session_start = data.get("session_start", "")
            model = data.get("model", "unknown")
            
            print(f"📚 Loaded conversation from {session_start} (model: {model})")
            print(f"💬 {len(self.conversation_history)} exchanges restored")
            return True
        except Exception as e:
            print(f"⚠️ Could not load conversation from {filename}: {str(e)}")
            return False
    
    def list_conversations(self) -> List[Dict]:
        """List all saved conversations with metadata."""
        conversations = []
        try:
            conversation_files = glob.glob(f"{self.conversations_dir}/conversation_*.json")
            
            for file_path in sorted(conversation_files, key=os.path.getmtime, reverse=True):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    conversations.append({
                        "file": file_path,
                        "session_start": data.get("session_start", "unknown"),
                        "model": data.get("model", "unknown"),
                        "exchanges": len(data.get("conversation", [])),
                        "file_size": os.path.getsize(file_path)
                    })
                except Exception:
                    continue
        except Exception as e:
            print(f"⚠️ Error listing conversations: {str(e)}")
        
        return conversations
    
    def display_conversations(self) -> None:
        """Display list of saved conversations."""
        conversations = self.list_conversations()
        
        if not conversations:
            print("📚 No saved conversations found.")
            return
        
        print("\n💾 Saved Conversations:")
        print("=" * 60)
        
        for i, conv in enumerate(conversations, 1):
            session_time = conv['session_start'][:19].replace('T', ' ')
            print(f"{i:2d}. {session_time} | {conv['exchanges']} exchanges | {conv['model']}")
        
        print("=" * 60)
        print("Use 'load <number>' to load a specific conversation")
    
    def start_new_conversation(self) -> None:
        """Start a fresh conversation session."""
        self.conversation_history = []
        self.current_conversation_file = None
        self.session_start_time = datetime.now()
        print("🆕 Started new conversation session!")

    def display_welcome(self):
        """Display welcome message and instructions."""
        print("🇪🇸 ¡Bienvenido! Welcome to the Spanish-English Tutor Chatbot! 🇺🇸")
        print("=" * 60)
        print("I'm here to help you practice Spanish and English!")
        print("\nYou can:")
        print("• Have conversations in Spanish or English")
        print("• Ask for translations")
        print("• Request grammar explanations")
        print("• Practice vocabulary")
        print("\nSpecial commands:")
        print("• Type 'quit' or 'salir' to exit")
        print("• Type 'help' or 'ayuda' for assistance")
        print("• Type 'clear' to clear conversation history")
        print("• Type 'conversations' to list saved conversations")
        print("• Type 'load <number>' to load a specific conversation")
        print("• Type 'new' to start a fresh conversation")
        print("=" * 60)

    def handle_special_commands(self, user_input: str) -> bool:
        """Handle special commands. Returns True if command was handled."""
        user_input_lower = user_input.lower().strip()
        
        if user_input_lower in ['quit', 'exit', 'salir']:
            print("\n¡Adiós! Thanks for practicing with me! Keep learning! 🎉")
            return True
        
        elif user_input_lower in ['help', 'ayuda']:
            print("\n📚 How to use the Spanish Tutor:")
            print("• Just type naturally in English or Spanish")
            print("• Ask questions like: 'How do you say hello in Spanish?'")
            print("• Practice: '¿Cómo estás?' or 'What does 'gracias' mean?'")
            print("• Request: 'Explain the difference between ser and estar'")
            print("• Type 'conversations' to see all saved conversations")
            print("• Type 'load <number>' to continue a previous conversation")
            print("• Type 'new' to start fresh (current conversation is auto-saved)")
            return False
        
        elif user_input_lower == 'clear':
            self.conversation_history = []
            print("\n🗑️ Conversation history cleared!")
            return False
        
        
        elif user_input_lower in ['conversations', 'conversaciones', 'list']:
            self.display_conversations()
            return False
        
        elif user_input_lower.startswith('load '):
            try:
                conv_number = int(user_input_lower.split()[1])
                conversations = self.list_conversations()
                if 1 <= conv_number <= len(conversations):
                    selected_conv = conversations[conv_number - 1]
                    if self.load_conversation(selected_conv['file']):
                        pass  # Success message already printed in load_conversation
                    else:
                        print("❌ Failed to load conversation")
                else:
                    print(f"❌ Invalid conversation number. Use 1-{len(conversations)}")
            except (ValueError, IndexError):
                print("❌ Usage: load <number> (e.g., 'load 1')")
            return False
        
        elif user_input_lower in ['new', 'nuevo', 'fresh']:
            self.start_new_conversation()
            return False
        
        return False

    def run(self):
        """Main chatbot loop."""
        # Check Ollama connection
        if not self.check_ollama_connection():
            print(f"❌ Error: Cannot connect to Ollama at {self.ollama_host}")
            print("Please make sure Ollama is running with: ollama serve")
            sys.exit(1)

        # Try to load the latest conversation
        if self.load_latest_conversation():
            print("\n🔄 Would you like to continue your previous conversation? (y/n): ", end="")
            choice = input().strip().lower()
            if choice not in ['y', 'yes', 'sí', 'si']:
                self.start_new_conversation()
        
        self.display_welcome()
        
        print(f"\n🤖 Using model: {self.model}")
        print("💬 Start chatting! (Type your message and press Enter)\n")

        while True:
            try:
                user_input = input("You: ").strip()
                
                if not user_input:
                    continue
                
                # Handle special commands
                if self.handle_special_commands(user_input):
                    break
                
                # Send message to Ollama
                print("🤖 Thinking...")
                response = self.send_message(user_input)
                
                if response:
                    print(f"Tutor: {response}\n")
                else:
                    print("❌ Sorry, I couldn't process your message. Please try again.\n")

            except KeyboardInterrupt:
                print("\n\n💾 Saving conversation...")
                self.save_conversation()
                print("👋 ¡Hasta luego! See you later!")
                break
            except Exception as e:
                print(f"❌ An error occurred: {str(e)}")

def main():
    # You can customize these parameters
    OLLAMA_HOST = "localhost:11434"
    MODEL = "llama3"  # Change to your preferred model (e.g., "mistral", "codellama")
    
    print("🚀 Starting Spanish-English Tutor Chatbot...")
    
    chatbot = SpanishTutorChatbot(ollama_host=OLLAMA_HOST, model=MODEL)
    chatbot.run()

if __name__ == "__main__":
    main()