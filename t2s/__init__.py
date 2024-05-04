import pyttsx3


class TextToSpeech:
    def __init__(self, rate, volume, voice=None):
        self.engine = pyttsx3.init()
        if voice:
            self.engine.setProperty('voice', voice)
        self.engine.setProperty('rate', rate)
        self.engine.setProperty('volume', volume)

    def get_voices(self):
        voices: list = [self.engine.getProperty('voices')]
        return [f'{x.id}' for x in voices[0]]

    def text_to_speech(self, text):
        self.engine.say(text)
        self.engine.runAndWait()
