#!/usr/bin/env python
import base64
from json import JSONEncoder, JSONDecoder

import dotenv
import numpy
import pyaudio
import os
import json
from transformers import pipeline
from transformers import AutoProcessor, AutoModel, AutoTokenizer, MarianMTModel
import struct
from datetime import datetime


# initialize by retrieving needed models locally if they don't exist to speed up translation?

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

    def update_cache(self, base_lang_string, audio_data):
        self.cache[base_lang_string] = {'audio': audio_data}


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


def play_audio_output(tensor):
    pass


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
    #1) get user voice input
    #using pre-recorded file for now.

    #2) generate text from voice input
    # asr = pipeline("automatic-speech-recognition")
    #using static text strings for now.

    # english to spanish text pipeline
    print_time()
    print("+++++++++ building e to s model/tokenizer +++++++++++++")
    e_to_s_model = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "models/Helsinki-NLP/opus-mt-tc-big-en-es", MarianMTModel)
    e_to_s_tokenizer = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es", AutoTokenizer)

    print_time()
    print("+++++++++ saving e to s model/tokenizer ++++++++++++++")
    save(e_to_s_model, "models/Helsinki-NLP/opus-mt-tc-big-en-es")
    save(e_to_s_tokenizer, "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es")

    print_time()
    print("+++++++++ creating e to s translation pipeline +++++++++")
    translator = pipeline("translation", model=e_to_s_model, tokenizer=e_to_s_tokenizer)


    # text to speech pipeline
    print_time()
    print("++++++++++++ building text to speech model/tokenizer ++++++++++")
    voice_preset = "v2/es_speaker_1"
    processor = get_model("suno/bark", "processors/suno/bark", AutoProcessor)
    model = get_model("suno/bark", "models/suno/bark", AutoModel)
    tokenizer = get_model("suno/bark", "tokenizers/suno/bark", AutoTokenizer)

    print_time()
    print("+++++++++++++ saving text to speech model/tokenizer +++++++++++")
    # save(processor, "processors/suno/bark")
    save(model, "models/suno/bark")
    save(tokenizer, "tokenizers/suno/bark")

    print_time()
    print("+++++++++++ creating text-to-speech pipeline ++++++++++++++")
    synth = pipeline("text-to-speech", model=model, tokenizer=tokenizer)

    #3)get translated text
    text = ["My name is Jeff.", "I like pizza and tacos.", "I work as a software engineer."]
    print_time()
    print(f"******* processing texts: {text}")
    speech_list = []
    for line in text:
        resp = translation_cache.get_value(line)
        if resp:
            speech_list.append(resp['audio'])
        else:
            print(f"no cached value found. Generating wav.")
            response_strings = get_translation_texts(translator.transform(line))
            for response in response_strings:
                inputs = processor(response, voice_preset=voice_preset)
                audio_array = model.generate(**inputs)
                audio_array = audio_array.cpu().numpy().squeeze()
                print(f"audio_array: {audio_array}")
                translation_cache.update_cache(line, audio_array)
                speech_list.append(audio_array)
                print(f"speech_list: {speech_list}")


    # # # 5) play audio output
    print_time()
    print("+++++++++++++++ playing audio +++++++++++++++++++++")
    paudio = pyaudio.PyAudio()
    stream = paudio.open(format=paudio.get_format_from_width(4),
                         channels=1,
                         rate=24000,
                         output=True)

    for i, line in enumerate(speech_list):
        stream.write(line, len(line))
    stream.stop_stream()
    stream.close()
    paudio.terminate()

    print(f"Saving cache.")
    translation_cache.save_cache('.')