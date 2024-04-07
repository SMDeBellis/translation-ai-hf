#!/usr/bin/env python
import queue
from json import JSONEncoder

import dotenv
import numpy
import pyaudio
import os
import json
import time
from transformers import pipeline
from transformers import AutoProcessor, AutoModel, AutoTokenizer, MarianMTModel
import struct
from datetime import datetime
from threading import Thread, Event
from queue import Queue, Empty, Full
from pynput import keyboard
import copy


# initialize by retrieving needed models locally if they don't exist to speed up translation?


# Initial implementation will use a spacebar keypressed to start and continue recording to buffer.
# When the spacebar is released recording will stop and be sent to the queue.





class MicrophoneListener(Thread):
    def __init__(self, input_queue, shutdown_event):
        super(MicrophoneListener, self).__init__()
        self.queue = input_queue
        self.shutdown_event = shutdown_event
        self.record_event = Event()
        self.CHUNK = 1024
        self.CHANNELS = 1
        self.RATE = 24000
        self.DEVICE_INDEX = 0
        self.buffer = []

    def run(self):
        try:
            with keyboard.Listener(on_press=self.record_audio_start, on_release=self.record_audio_stop) as listener:
                listener.join()
            self.shutdown_event.clear()
        except Exception as e:
            print(e)
            self.shutdown_event.set()

    def record_audio_stop(self, key):
        print(f"key up press: {key}")
        if key == keyboard.Key.alt_gr:
            print("on release called. setting stop_event")
            self.record_event.set()
            if self.shutdown_event.is_set():
                return False
            else:
                return True

    def record_audio_start(self, key):
        if key == keyboard.Key.alt_gr:
            try:
                self.buffer = []
                p = pyaudio.PyAudio()
                stream = p.open(format=p.get_format_from_width(4),
                                channels=self.CHANNELS,
                                rate=self.RATE,
                                input=True,
                                input_device_index=p.get_default_input_device_info()['index'],
                                frames_per_buffer=self.CHUNK,
                                stream_callback=self.handle_mic_input
                                )

                while stream.is_active():
                    print("stream is active")
                    time.sleep(0.2)

                self.queue.put(copy.deepcopy(self.buffer))
                self.buffer = []
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


    def handle_mic_input(self, in_data, frame_count, time_info, status_flags):
        print(f"self.record_event.is_set(): {self.record_event.is_set()}")
        # print(f"status_flags: {status_flags}")
        if frame_count > 0:
            # print(f"loading data: {in_data}")
            self.buffer.append(in_data)

        if self.record_event.is_set():
            output_flag = pyaudio.paComplete
        else:
            output_flag = pyaudio.paContinue

        return None, output_flag



class TranslationsCache:
    def __init__(self, cache_dir):
        self.cache_file = "language-cache.json"
        self.cache_dir = cache_dir
        self.cache = self.build_cache(cache_dir)

    class NumpyArrayEncoder(JSONEncoder):
        def default(self, obj):
            if isinstance(obj, numpy.ndarray):
                return {
                    '__ndarray__': obj.tolist(),
                }
            return JSONEncoder.default(self, obj)

    def build_cache(self, cache_dir):
        try:
            with open(os.path.join(cache_dir, self.cache_file), 'r') as f:
                return json.load(f, object_hook=json_numpy_obj_hook)
        except IOError as ioe:
            print(f"Error trying to access: {os.path.join(cache_dir, )}, {ioe}.")
            return {}

    def save_cache(self, cache_dir):
        try:
            with open(os.path.join(cache_dir, self.cache_file), 'w') as f:
                f.write(json.dumps(self.cache, cls=self.NumpyArrayEncoder))
        except IOError as ioe:
            print(f"Error trying to save cache to: {os.path.join(cache_dir, )}, {ioe}.")

    def get_value(self, key):
        if key in self.cache:
            return self.cache[key]
        return None

    def update_cache(self, base_lang_string, translated_string, audio_data):
        self.cache[base_lang_string] = {
            'audio': audio_data,
            'translated-string': translated_string
        }


def json_numpy_obj_hook(dct):
    """
    Decodes a previously encoded numpy ndarray
    with proper shape and dtype
    :param dct: (dict) json encoded ndarray
    :return: (ndarray) if input was an encoded ndarray
    """
    if isinstance(dct, dict) and '__ndarray__' in dct:
        data = dct['__ndarray__']
        buf = struct.pack(f'{len(data)}f', *data)
        return numpy.frombuffer(buf, numpy.float32).reshape(-1)
    return dct


def get_translation_texts(list_of_dicts):
    return [d['translation_text'] for d in list_of_dicts]


def play_audio_output(audio):
    paudio = pyaudio.PyAudio()
    stream = paudio.open(format=paudio.get_format_from_width(4),
                         channels=1,
                         rate=24000,
                         output=True)
    stream.write(audio, len(audio))
    # for i, line in enumerate(audio):
    #     stream.write(line, len(line))
    stream.stop_stream()
    stream.close()
    paudio.terminate()


def save(to_save, dest_dir):
    if not os.path.exists(dest_dir):
        to_save.save_pretrained(dest_dir)
    else:
        print("not saving at %s" % dest_dir)


def get_processor(model_name, src_dir, obj, **kwargs):
    if os.path.exists(src_dir):
        print(f"getting saved version from: {src_dir}")
        return obj.from_pretrained(os.path.join(src_dir), **kwargs)
    return obj.from_pretrained(model_name, **kwargs)


def get_model(model_name, src_dir, obj):
    if os.path.exists(src_dir):
        print("getting saved version from: %s" % os.path.join(src_dir))
        return obj.from_pretrained(os.path.join(src_dir))
    return obj.from_pretrained(model_name)


def generate_translated_wav(str_to_translate, pipeline_obj):
    return pipeline_obj(str_to_translate, forward_params={"do_sample": True})


def print_time():
    print(datetime.now().strftime("%H:%M:%S:%f"))


if __name__ == '__main__':

    translation_cache = TranslationsCache(".")
    # 1) get user voice input
    # using pre-recorded file for now.

    # 2) generate text from voice input
    # asr = pipeline("automatic-speech-recognition")
    # using static text strings for now.

    # english to spanish text pipeline
    # print("+++++++++ building e to s model/tokenizer +++++++++++++")
    # e_to_s_model = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "models/Helsinki-NLP/opus-mt-tc-big-en-es",
    #                          MarianMTModel)
    # e_to_s_tokenizer = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es",
    #                              AutoTokenizer)
    #
    # print("+++++++++ saving e to s model/tokenizer ++++++++++++++")
    # save(e_to_s_model, "models/Helsinki-NLP/opus-mt-tc-big-en-es")
    # save(e_to_s_tokenizer, "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es")
    #
    # print("+++++++++ creating e to s translation pipeline +++++++++")
    # translator = pipeline("translation", model=e_to_s_model, tokenizer=e_to_s_tokenizer)
    #
    # # text to speech pipeline
    # print("++++++++++++ building text to speech model/tokenizer ++++++++++")
    # voice_preset = "v2/es_speaker_1"
    # audio_processor = get_model("suno/bark", "processors/suno/bark", AutoProcessor)
    # audio_model = get_model("suno/bark", "models/suno/bark", AutoModel)
    # # audio_tokenizer = get_model("suno/bark", "tokenizers/suno/bark", AutoTokenizer)
    #
    # print("+++++++++++++ saving text to speech model/processor +++++++++++")
    # save(audio_processor, "processors/suno/bark")
    # save(audio_model, "models/suno/bark")
    # # save(audio_tokenizer, "tokenizers/suno/bark")

    # Start mic listener
    input_q = queue.Queue()
    close_event = Event()
    mic_thread = MicrophoneListener(input_q, close_event)
    mic_thread.setDaemon(True)
    mic_thread.start()

    # 3) get translated text
    print("************* Ready for recording *****************")
    while speech := input_q.get():
        try:
            print(f"++++++ speech: {speech}")
            # current_english_string = input("--> ")
            # if current_english_string == 'exit':
            #     print("Received exit command. Exiting program.")
            #     break
            # elif current_english_string == 'repeat':
            #     if len(speech) == 0:
            #         print("No Audio processed to repeat. Please enter a text to translate.")
            #     else:
            #         play_audio_output(speech)
            # else:
            #     # print(f"input: {current_english_string}")
            #     resp = translation_cache.get_value(current_english_string)
            #     if resp:
            #         print(f"Translation: {resp['translated-string']}")
            #         speech = resp['audio']
            #     else:
            #         # print(f"New input received: {current_english_string}. Translating now.")
            #         response_strings = get_translation_texts(translator.transform(current_english_string))
            #         for response in response_strings:
            #             inputs = audio_processor(response, voice_preset=voice_preset)
            #             audio_array = audio_model.generate(**inputs)
            #             audio_array = audio_array.cpu().numpy().squeeze()
            #             # print(f"audio_array: {audio_array}")
            #             translation_cache.update_cache(current_english_string, response, audio_array)
            #             speech = audio_array
            #             print(f"Translation: {response}")
            #             # print(f"speech_list: {speech}")
            #
            #     play_audio_output(speech)

        except KeyboardInterrupt:
            print("Received keyboard interrupt. Exiting program.")
            close_event.set()
            break

    print(f"Saving cache.")
    translation_cache.save_cache('.')
