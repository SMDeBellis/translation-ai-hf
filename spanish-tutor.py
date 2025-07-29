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
from datetime import datetime
from typing import Dict, Optional

class SpanishTutorChatbot:
    def __init__(self, ollama_host: str = "localhost:11434", model: str = "llama2"):
        self.ollama_host = ollama_host
        self.model = model
        self.base_url = f"http://{ollama_host}/api"
        self.conversation_history = []
        self.grammar_notes_file = "spanish_grammar_notes.md"
        
        # System prompt to establish the chatbot's role
        self.system_prompt = """You are a helpful Spanish-English tutoring chatbot. Your role is to:
1. Help users practice Spanish conversation
2. Provide translations between Spanish and English
3. Explain grammar concepts when asked
4. Correct pronunciation and usage mistakes
5. Encourage learning with positive feedback

Always be patient, encouraging, and educational. When users make mistakes, gently correct them and explain why. 
You can respond in both English and Spanish as appropriate for the learning context.

IMPORTANT: When you explain grammar rules, start your explanation with [GRAMMAR] so it can be automatically saved to notes."""

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
                self.conversation_history.append({"user": message, "bot": bot_response})
                return bot_response
            else:
                return f"Error: Received status code {response.status_code}"

        except requests.exceptions.RequestException as e:
            return f"Error connecting to Ollama: {str(e)}"

    def save_grammar_rule(self, response: str) -> None:
        """Extract and save grammar rules from bot responses."""
        if "[GRAMMAR]" in response:
            try:
                # Extract the grammar explanation
                grammar_content = response[response.find("[GRAMMAR]") + 9:].strip()
                
                # Create timestamp
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                # Format the note
                note_entry = f"\n## Grammar Rule - {timestamp}\n\n{grammar_content}\n\n---\n"
                
                # Append to file
                with open(self.grammar_notes_file, "a", encoding="utf-8") as f:
                    if not os.path.exists(self.grammar_notes_file) or os.path.getsize(self.grammar_notes_file) == 0:
                        f.write("# Spanish Grammar Notes\n\n")
                        f.write("*Automatically generated grammar rules from Spanish tutor sessions*\n\n")
                    f.write(note_entry)
                
                print("📝 Grammar rule saved to notes!")
                
            except Exception as e:
                print(f"⚠️ Could not save grammar rule: {str(e)}")

    def view_grammar_notes(self) -> None:
        """Display saved grammar notes."""
        if not os.path.exists(self.grammar_notes_file):
            print("📚 No grammar notes found yet. Start asking about grammar rules!")
            return
        
        try:
            with open(self.grammar_notes_file, "r", encoding="utf-8") as f:
                content = f.read()
                if content.strip():
                    print("\n📖 Your Saved Grammar Notes:")
                    print("=" * 50)
                    print(content)
                    print("=" * 50)
                else:
                    print("📚 Grammar notes file is empty. Start asking about grammar rules!")
        except Exception as e:
            print(f"⚠️ Error reading grammar notes: {str(e)}")

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
        print("• Type 'notes' to view saved grammar rules")
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
            print("• Type 'notes' to view saved grammar rules")
            return False
        
        elif user_input_lower == 'clear':
            self.conversation_history = []
            print("\n🗑️ Conversation history cleared!")
            return False
        
        elif user_input_lower in ['notes', 'notas', 'grammar']:
            self.view_grammar_notes()
            return False
        
        return False

    def run(self):
        """Main chatbot loop."""
        # Check Ollama connection
        if not self.check_ollama_connection():
            print(f"❌ Error: Cannot connect to Ollama at {self.ollama_host}")
            print("Please make sure Ollama is running with: ollama serve")
            sys.exit(1)

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
                    # Save grammar rules automatically
                    self.save_grammar_rule(response)
                else:
                    print("❌ Sorry, I couldn't process your message. Please try again.\n")

            except KeyboardInterrupt:
                print("\n\n👋 ¡Hasta luego! See you later!")
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