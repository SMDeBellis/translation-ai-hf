#!/usr/bin/env python
import os
import queue
import wave
from datetime import datetime
from threading import Event

import pyaudio
import torch
from transformers import AutoProcessor, AutoTokenizer, MarianMTModel
from transformers import pipeline, AutoModelForSpeechSeq2Seq

from caching.translationcache import TranslationsCache
from consumers import MicrophoneListener
from t2s import TextToSpeech

WAVE_OUTPUT_FILENAME = "/tmp/recorded_audio.wav"


def get_translation_texts(list_of_dicts):
    return [d['translation_text'] for d in list_of_dicts]


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


def print_time():
    print(datetime.now().strftime("%H:%M:%S:%f"))


def text_to_speech(line, text_to_speech_map, language_id):
    try:
        text_to_speech_map[language_id].text_to_speech(line)
    except KeyError:
        print(f"No TextToSpeech for language: {language_id}, cannot output line: {line}.")


if __name__ == '__main__':
    t2s_es = TextToSpeech(120, 0.5, 'com.apple.eloquence.es-ES.Eddy')
    t2s_en = TextToSpeech(120, 0.5, 'com.apple.eloquence.en-US.Eddy')
    t2s_map = {
        'en': t2s_en,
        'es': t2s_es
    }

    translation_cache = TranslationsCache(".")

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

    # changes speech to text.
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

    lang_id_model = pipeline("text-classification", model="papluca/xlm-roberta-base-language-detection")

    # english to spanish text pipeline
    print("+++++++++ building e to s model/tokenizer +++++++++++++")
    e_to_s_model = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "models/Helsinki-NLP/opus-mt-tc-big-en-es",
                             MarianMTModel)
    e_to_s_tokenizer = get_model("Helsinki-NLP/opus-mt-tc-big-en-es", "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es",
                                 AutoTokenizer)

    # spanish to english text pipeline
    print("+++++++++ building e to s model/tokenizer +++++++++++++")
    s_to_e_model = get_model("Helsinki-NLP/opus-mt-es-en", "models/Helsinki-NLP/opus-mt-es-en", MarianMTModel)
    s_to_e_tokenizer = get_model("Helsinki-NLP/opus-mt-es-en", "tokenizers/Helsinki-NLP/opus-mt-es-en", AutoTokenizer)

    # print("+++++++++ saving e to s model/tokenizer ++++++++++++++")
    save(e_to_s_model, "models/Helsinki-NLP/opus-mt-tc-big-en-es")
    save(e_to_s_tokenizer, "tokenizers/Helsinki-NLP/opus-mt-tc-big-en-es")
    save(s_to_e_model, "models/Helsinki-NLP/opus-mt-es-en")
    save(s_to_e_tokenizer, "tokenizers/Helsinki-NLP/opus-mt-es-en")


    # print("+++++++++ creating e to s translation pipeline +++++++++")
    e_to_s_translator = pipeline("translation", model=e_to_s_model, tokenizer=e_to_s_tokenizer)
    s_to_e_translator = pipeline("translation", model=s_to_e_model, tokenizer=s_to_e_tokenizer)

    last_english_str = ""
    last_translated_str = ""
    last_translated_lang_id = ""
    use_audio_input = False
    translation_error_en = "Unable to determine base language of the given statement."
    translation_error_es = get_translation_texts(e_to_s_translator.transform(translation_error_en))[0]

    input_q = queue.Queue()
    close_event = Event()

    input_type = input("Enter input type: 1) audio, 2) keyboard -> ")
    if input_type.strip() == "1":
        use_audio_input = True
        # Start mic listener
        stop_recording_event = Event()
        mic_thread = MicrophoneListener(close_event, stop_recording_event, input_q)
        mic_thread.setDaemon(True)
        mic_thread.start()
        print("************* Ready for recording *****************")

    while True:
        try:
            if use_audio_input:
                # 1) get user voice input. blocks until entry in queue.
                print("Hold option-right to record audio.")
                speech = input_q.get()
                # write to file as I haven't found a better way to do it from direct wav input.
                with wave.open(WAVE_OUTPUT_FILENAME, 'wb') as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(pyaudio.get_sample_size(pyaudio.paFloat32))
                    wf.setframerate(24000)
                    wf.writeframes(speech)

                # Translate wave file to string.
                result = pipe(WAVE_OUTPUT_FILENAME)
                current_english_string = result["text"].strip()
            else:
                current_english_string = input("-> ")

            print(current_english_string)

            if str.lower(current_english_string).strip() == 'end program' or str.lower(current_english_string).strip() == 'end program.':
                print("Received exit command. Exiting program.")
                break
            elif str.lower(current_english_string).strip() == 'repeat last' or str.lower(current_english_string).strip() == 'repeat last.':
                if len(last_translated_str) == 0:
                    print("No Audio processed to repeat. Please enter a text to translate.")
                else:
                    print(f"repeating from cache: {last_translated_str}")
                    text_to_speech(last_translated_str, t2s_map, last_translated_lang_id)
            else:
                # print(f"input: {current_english_string}")
                last_english_str = current_english_string
                resp = translation_cache.get_value(current_english_string)
                if resp:
                    print(f"Translation from cache: {resp['translated-string']}")
                    last_translated_str = resp['translated-string']
                    text_to_speech(last_translated_str, t2s_map, resp['translation-lang'])
                else:
                    # print(f"New input received: {current_english_string}. Translating now.")
                    # lang_id, _ = langid.classify(current_english_string)
                    lang_id = lang_id_model.transform(current_english_string)[0]['label']
                    print(f'Current string to translate base language: {lang_id}')
                    if lang_id == 'en':
                        last_translated_lang_id = 'es'
                        response_strings = get_translation_texts(e_to_s_translator.transform(current_english_string))
                    elif lang_id == 'es':
                        last_translated_lang_id = 'en'
                        response_strings = get_translation_texts(s_to_e_translator.transform(current_english_string))
                    else:
                        last_translated_lang_id = ''
                        response_strings = []

                    if not last_translated_lang_id:
                        text_to_speech(translation_error_en, t2s_map, 'en')
                        text_to_speech(translation_error_es, t2s_map, 'es')
                    else:
                        for response in response_strings:
                            print(f"Translation: {response}")
                            text_to_speech(response, t2s_map, last_translated_lang_id)
                            translation_cache.update_cache(last_english_str, response, last_translated_lang_id)
                            last_translated_str = response

        except KeyboardInterrupt:
            print("Received keyboard interrupt. Exiting program.")
            close_event.set()
            break

    print(f"Saving cache.")
    translation_cache.save_cache('.')
