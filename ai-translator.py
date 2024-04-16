#!/usr/bin/env python
import io
import queue
import wave
from json import JSONEncoder

import dotenv
import numpy
import pyaudio
import os
import json
import time

import scipy
import torch
from transformers import pipeline, Speech2TextForConditionalGeneration, Speech2TextProcessor, AutoModelForSpeechSeq2Seq
from transformers import AutoProcessor, AutoModel, AutoTokenizer, MarianMTModel
import struct
from datetime import datetime
from threading import Thread, Event
from queue import Queue, Empty, Full
from pynput import keyboard
import copy

from datasets import load_dataset

WAVE_OUTPUT_FILENAME = "/tmp/recorded_audio.wav"
# initialize by retrieving needed models locally if they don't exist to speed up translation?


# Initial implementation will use a spacebar keypressed to start and continue recording to buffer.
# When the spacebar is released recording will stop and be sent to the queue.

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
    stream.write(audio, len(audio) * 2)
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
    # TODO: save this model and load locally
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    model_id = "openai/whisper-large-v3"

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True
    )
    model.to(device)

    processor = AutoProcessor.from_pretrained(model_id)

    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        max_new_tokens=128,
        chunk_length_s=30,
        batch_size=16,
        return_timestamps=True,
        torch_dtype=torch_dtype,
        device=device,
    )


    # using static text strings for now.

    # english to spanish text pipeline
    print("+++++++++ building e to s model/tokenizer +++++++++++++")
    e_to_s_model = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "models/Helsinki-NLP/opus-mt-tc-big-en-es",
                             MarianMTModel)
    e_to_s_tokenizer = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es",
                                 AutoTokenizer)

    # print("+++++++++ saving e to s model/tokenizer ++++++++++++++")
    save(e_to_s_model, "models/Helsinki-NLP/opus-mt-tc-big-en-es")
    save(e_to_s_tokenizer, "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es")
    #
    # print("+++++++++ creating e to s translation pipeline +++++++++")
    translator = pipeline("translation", model=e_to_s_model, tokenizer=e_to_s_tokenizer)

    # # text to speech pipeline
    print("++++++++++++ building text to speech model/tokenizer ++++++++++")
    voice_preset = "v2/es_speaker_1"
    audio_processor = get_model("suno/bark", "processors/suno/bark", AutoProcessor)
    audio_model = get_model("suno/bark", "models/suno/bark", AutoModel)
    # audio_tokenizer = get_model("suno/bark", "tokenizers/suno/bark", AutoTokenizer)

    print("+++++++++++++ saving text to speech model/processor +++++++++++")
    save(audio_processor, "processors/suno/bark")
    save(audio_model, "models/suno/bark")
    # save(audio_tokenizer, "tokenizers/suno/bark")

    # Start mic listener
    input_q = queue.Queue()
    close_event = Event()
    stop_recording_event = Event()
    mic_thread = MicrophoneListener(close_event, stop_recording_event, input_q)
    mic_thread.setDaemon(True)
    mic_thread.start()
    last_english_str = ""

    # 3) get translated text

    print("************* Ready for recording *****************")
    while True:
        try:
            speech = input_q.get()
            # print(f"++++++ speech: {type(speech)}")
            with wave.open(WAVE_OUTPUT_FILENAME, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(pyaudio.get_sample_size(pyaudio.paFloat32))
                wf.setframerate(24000)
                wf.writeframes(speech)
            play_audio_output(speech)

            result = pipe(WAVE_OUTPUT_FILENAME)
            # print(result["text"])
            current_english_string = result["text"].strip()
            print(current_english_string)


            # current_english_string = input("--> ")
            if str.lower(current_english_string).strip() == 'end program' or str.lower(current_english_string).strip() == 'end program.':
                print("Received exit command. Exiting program.")
                break
            elif str.lower(current_english_string).strip() == 'repeat last' or str.lower(current_english_string).strip() == 'repeat last.':
                if len(last_english_str) == 0:
                    print("No Audio processed to repeat. Please enter a text to translate.")
                else:
                    print(f"repeating from cache: {last_english_str}")
                    play_audio_output(translation_cache.get_value(last_english_str)['audio'])
            else:
                # print(f"input: {current_english_string}")
                last_english_str = current_english_string
                resp = translation_cache.get_value(current_english_string)
                if resp:
                    print(f"Translation: {resp['translated-string']}")
                    speech = resp['audio']
                else:
                    # print(f"New input received: {current_english_string}. Translating now.")
                    response_strings = get_translation_texts(translator.transform(current_english_string))
                    for response in response_strings:
                        inputs = audio_processor(response, voice_preset=voice_preset)
                        audio_array = audio_model.generate(**inputs)
                        audio_array = audio_array.cpu().numpy().squeeze()
                        # print(f"audio_array: {audio_array}")
                        translation_cache.update_cache(current_english_string, response, audio_array)
                        speech = audio_array
                        print(f"Translation: {response}")
                        # print(f"speech_list: {speech}")

                play_audio_output(speech)

        except KeyboardInterrupt:
            print("Received keyboard interrupt. Exiting program.")
            close_event.set()
            break

    print(f"Saving cache.")
    translation_cache.save_cache('.')
