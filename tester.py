from pynput import keyboard
from queue import Queue, Empty, Full
from threading import Event, Thread
import pyaudio
import time


class QueueInserter(Thread):
    def __init__(self, input_queue, t_shutdown_event):
        super(QueueInserter, self).__init__()
        self.input_queue = input_queue
        self.shutdown_event = t_shutdown_event
        self.setDaemon(True)

    def run(self):
        try:
            p = pyaudio.PyAudio()
            stream = p.open(format=p.get_format_from_width(4),
                            channels=1,
                            rate=24000,
                            input=True,
                            # output=False,
                            input_device_index=p.get_default_input_device_info()['index'],
                            frames_per_buffer=1024,
                            stream_callback=self.microphone_callback)

            while stream.is_active():
                # print("stream is active")
                time.sleep(0.2)

            # print("stream no longer active")
            # print("Closing stream")
            stream.close()

            # print("terminating p")
            p.terminate()

            if self.shutdown_event.is_set():
                print("Unsetting shutdown event")
                self.shutdown_event.clear()
        except Exception as e:
            print(e)


    def microphone_callback(self, in_data, frame_count, time_info, status_flags):
        # print(f"status_flags: {status_flags}")
        if frame_count > 0:
            print(f"loading data: {in_data}")
            self.input_queue.put(in_data)

        if self.shutdown_event.is_set():
            output_flag = pyaudio.paComplete
        else:
            output_flag = pyaudio.paContinue

        return None, output_flag



def keyboard_run(sd_event, sr_event):
    def on_press(key):
        try:
            if key == keyboard.Key.alt_gr:
                insertion_thread = QueueInserter(byte_collector_queue, stop_recording_event)
                insertion_thread.setDaemon(True)
                insertion_thread.start()
                print("starting recording")
        except AttributeError:
            pass
        except KeyboardInterrupt:
            print("Shutting down")
            sd_event.set()

    def on_release(key):
        if key == keyboard.Key.alt_gr:
            print("on release called. setting stop_event")
            sr_event.set()
            if sd_event.is_set():
                return False
            else:
                return True

    try:
        with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
            listener.join()
    except Exception as e:
        print(e)
        sd_event.set()

if __name__ == '__main__':
    byte_collector_queue = Queue()
    stop_recording_event = Event()
    shutdown_event = Event()

    try:
        # Collect events until released
        keyboard_thread = Thread(target=keyboard_run, args=[shutdown_event, stop_recording_event], daemon=True)
        keyboard_thread.start()

        while not shutdown_event.is_set():
            time.sleep(0.2)

        print("shutdown_event has been set. Shutting down")

    except KeyboardInterrupt:
        stop_recording_event.set()
    finally:
        print("finally setting stop_record event.")
        stop_recording_event.set()
        print("finally setting shutdown_event.")
        shutdown_event.set()

        byte_list = []

        while not byte_collector_queue.empty():
            byte_list.append(byte_collector_queue.get())

        print(f"byte_list: {byte_list}")
        print(f"byte_list size: {len(byte_list)}")
        print("bye bye")
