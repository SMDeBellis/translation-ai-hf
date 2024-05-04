from threading import Thread
import pyaudio
import numpy
import time


class QueueInserter(Thread):
    def __init__(self, input_queue, t_shutdown_event):
        super(QueueInserter, self).__init__()
        self.input_queue = input_queue
        self.shutdown_event = t_shutdown_event
        self.setDaemon(True)
        self.audio_buffer = []

    def run(self):
        try:
            p = pyaudio.PyAudio()
            # TODO: move args to class vars
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
            single_array = numpy.concatenate(self.audio_buffer)
            self.input_queue.put(single_array)
            self.audio_buffer = []
            if self.shutdown_event.is_set():
                print("Unsetting shutdown event")
                self.shutdown_event.clear()
        except Exception as e:
            print(e)

    def microphone_callback(self, in_data, frame_count, time_info, status_flags):
        # print(f"status_flags: {status_flags}")
        if frame_count > 0:
            data = numpy.frombuffer(in_data)
            # print(f"data: {type(data[0])}")
            # print(f"loading data: {type(in_data)}")
            self.audio_buffer.append(data)

        if self.shutdown_event.is_set():
            output_flag = pyaudio.paComplete
        else:
            output_flag = pyaudio.paContinue

        return None, output_flag