#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_NAME="${MODEL_NAME:-phi35-financial-q8}"
MODELFILE="${MODELFILE:-$ROOT_DIR/ollama_server/Modelfile}"
PROMPT="${1:-Give me a short risk analysis for a company with high debt and declining revenue.}"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: '$cmd' is required but not installed."
    exit 1
  fi
}

wait_for_ollama() {
  local retries=30
  local i
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

extract_base_model() {
  awk '/^[[:space:]]*FROM[[:space:]]+/ {print $2; exit}' "$MODELFILE"
}

require_cmd ollama
require_cmd curl

if [[ ! -f "$MODELFILE" ]]; then
  echo "Error: Modelfile not found at $MODELFILE"
  exit 1
fi

if ! curl -fsS "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
  echo "Ollama server is not running. Starting it in the background..."
  nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
  if ! wait_for_ollama; then
    echo "Error: Ollama server did not become ready. Check /tmp/ollama-serve.log"
    exit 1
  fi
fi

if ! ollama list | awk 'NR>1 {print $1}' | grep -qx "$MODEL_NAME"; then
  BASE_MODEL="$(extract_base_model || true)"
  if [[ -n "${BASE_MODEL}" ]]; then
    echo "Ensuring base model '$BASE_MODEL' is downloaded (download progress will be shown)..."
    ollama pull "$BASE_MODEL"
  else
    echo "Warning: Could not detect base model from $MODELFILE. Skipping explicit pull step."
  fi

  echo "Creating local model '$MODEL_NAME' from $MODELFILE..."
  ollama create "$MODEL_NAME" -f "$MODELFILE"
else
  echo "Model '$MODEL_NAME' already exists locally."
fi

echo
echo "Running prompt test on '$MODEL_NAME'..."
echo "Prompt: $PROMPT"
echo
start_time=$SECONDS
ollama run "$MODEL_NAME" "$PROMPT"
elapsed_time=$((SECONDS - start_time))
echo
echo "Response time: ${elapsed_time}s"
