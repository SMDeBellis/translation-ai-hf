from threading import Thread
from pynput import keyboard
from .queueinserter import QueueInserter



class MicrophoneListener(Thread):
    def __init__(self, shutdown_ev, stop_recording_ev, byte_queue):
        super(MicrophoneListener, self).__init__()
        self.shutdown_ev = shutdown_ev
        self.stop_recording_ev = stop_recording_ev
        self.byte_queue = byte_queue

    def run(self):
        try:
            with keyboard.Listener(on_press=self.on_press, on_release=self.on_release) as listener:
                listener.join()
        except Exception as e:
            print(e)
            self.shutdown_ev.set()

    def on_press(self, key):
        try:
            if key == keyboard.Key.alt_gr:
                insertion_thread = QueueInserter(self.byte_queue, self.stop_recording_ev)
                insertion_thread.setDaemon(True)
                insertion_thread.start()
                print("starting recording")
        except AttributeError:
            pass
        except KeyboardInterrupt:
            print("Shutting down")
            self.shutdown_ev.set()

    def on_release(self, key):
        if key == keyboard.Key.alt_gr:
            print("on release called. setting stop_event")
            self.stop_recording_ev.set()
            if self.shutdown_ev.is_set():
                return False
            else:
                return True
