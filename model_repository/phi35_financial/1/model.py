# Copyright 2023, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions
# are met:
#  * Redistributions of source code must retain the above copyright
#    notice, this list of conditions and the following disclaimer.
#  * Redistributions in binary form must reproduce the above copyright
#    notice, this list of conditions and the following disclaimer in the
#    documentation and/or other materials provided with the distribution.
#  * Neither the name of NVIDIA CORPORATION nor the names of its
#    contributors may be used to endorse or promote products derived
#    from this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ``AS IS'' AND ANY
# EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
# PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
# CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
# EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
# PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
# PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
# OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
# OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
import os

os.environ["TRANSFORMERS_CACHE"] = "/opt/tritonserver/model_repository/phi35_financial/hf-cache"

import json

import numpy as np
import torch
import transformers
from transformers import BitsAndBytesConfig
import triton_python_backend_utils as pb_utils


def normalize_rope_scaling(config):
    rope_scaling = getattr(config, "rope_scaling", None)
    if not isinstance(rope_scaling, dict):
        return config

    fixed = dict(rope_scaling)
    if "type" not in fixed and "rope_type" in fixed:
        fixed["type"] = fixed["rope_type"]

    if fixed.get("type") == "default":
        config.rope_scaling = None
        return config

    config.rope_scaling = fixed
    return config


class TritonPythonModel:
    def initialize(self, args):
        self.logger = pb_utils.Logger
        self.model_config = json.loads(args["model_config"])
        self.model_params = self.model_config.get("parameters", {})
        default_hf_model = "microsoft/Phi-3-mini-4k-instruct"
        default_max_gen_length = "512"
        default_quantization = "8bit"
        hf_model = self.model_params.get("huggingface_model", {}).get(
            "string_value", default_hf_model
        )
        # Token optionnel — uniquement nécessaire pour les modèles privés
        private_repo_token = os.environ.get("PRIVATE_REPO_TOKEN", "") or None

        # Check for user-specified max length in model config parameters
        self.max_output_length = int(
            self.model_params.get("max_output_length", {}).get(
                "string_value", default_max_gen_length
            )
        )
        self.quantization = self.model_params.get("quantization", {}).get(
            "string_value", default_quantization
        ).lower()
        self.temperature = float(
            self.model_params.get("temperature", {}).get("string_value", "0.7")
        )
        self.top_p = float(
            self.model_params.get("top_p", {}).get("string_value", "0.9")
        )
        # LoRA adapters disabled in this build; serving base model only.

        self.logger.log_info(f"Max output length: {self.max_output_length}")
        self.logger.log_info(f"Quantization mode: {self.quantization}")
        self.logger.log_info(f"LoRA adapter path: {self.lora_adapter_path}")
        self.logger.log_info(f"Loading HuggingFace model: {hf_model}...")
        # Assume tokenizer available for same model
        self.tokenizer = transformers.AutoTokenizer.from_pretrained(
            hf_model, token=private_repo_token
        )

        model_kwargs = {
            "token": private_repo_token,
            "device_map": "auto" if torch.cuda.is_available() else None,
            "trust_remote_code": True,
            "low_cpu_mem_usage": True,
        }

        if torch.cuda.is_available():
            model_kwargs["torch_dtype"] = torch.float16
            if self.quantization == "4bit":
                model_kwargs["quantization_config"] = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_quant_type="nf4",
                )
            elif self.quantization == "8bit":
                model_kwargs["quantization_config"] = BitsAndBytesConfig(
                    load_in_8bit=True
                )
            elif self.quantization not in ("none", "fp16"):
                self.logger.log_warn(
                    f"Unknown quantization '{self.quantization}', falling back to fp16"
                )
        else:
            model_kwargs["torch_dtype"] = torch.float32
            if self.quantization in ("4bit", "8bit"):
                self.logger.log_warn(
                    "Requested quantization requires CUDA; falling back to CPU float32"
                )

        model_config = normalize_rope_scaling(
            transformers.AutoConfig.from_pretrained(
                hf_model,
                token=private_repo_token,
                trust_remote_code=True,
            )
        )
        if not torch.cuda.is_available():
            model_config._attn_implementation = "eager"

        self.model = transformers.AutoModelForCausalLM.from_pretrained(
            hf_model,
            config=model_config,
            **model_kwargs,
        )

        self.logger.log_info("Serving base model only (LoRA support removed).")

        self.pipeline = transformers.pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
        )

    def execute(self, requests):
        responses = []
        for request in requests:
            # Assume input named "prompt", specified in autocomplete above
            input_tensor = pb_utils.get_input_tensor_by_name(request, "text_input")
            prompt = input_tensor.as_numpy()[0].decode("utf-8")

            response = self.generate(prompt)
            responses.append(response)

        return responses

    def generate(self, prompt):
        sequences = self.pipeline(
            prompt,
            do_sample=True,
            top_k=10,
            top_p=self.top_p,
            temperature=self.temperature,
            use_cache=False,
            num_return_sequences=1,
            eos_token_id=self.tokenizer.eos_token_id,
            max_new_tokens=self.max_output_length,
        )

        output_tensors = []
        texts = []
        for i, seq in enumerate(sequences):
            text = seq["generated_text"]
            self.logger.log_info(f"Sequence {i+1}: {text}")
            texts.append(text)

        tensor = pb_utils.Tensor("text_output", np.array(texts, dtype=np.object_))
        output_tensors.append(tensor)
        response = pb_utils.InferenceResponse(output_tensors=output_tensors)
        return response

    def finalize(self):
        print("Cleaning up...")
