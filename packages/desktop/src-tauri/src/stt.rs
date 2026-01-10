//! Speech-to-text module using Parakeet TDT 0.6B ONNX model.
//!
//! This module provides local, offline speech recognition using NVIDIA's
//! Parakeet TDT model running via ONNX Runtime.

use ort::session::{builder::GraphOptimizationLevel, Session};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

const MODEL_NAME: &str = "parakeet-tdt-0.6b-v3";
const HF_BASE_URL: &str =
    "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/main";

/// Model files required for inference
const MODEL_FILES: &[&str] = &[
    "nemo128.onnx",
    "encoder-model.onnx",
    "encoder-model.onnx.data", // ~2.4GB weights file
    "decoder_joint-model.onnx",
    "vocab.txt",
    "config.json",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ModelStatus {
    NotDownloaded,
    Downloading { progress: f32 },
    Ready,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SttStatus {
    pub model_status: ModelStatus,
    pub is_recording: bool,
}

/// State for the STT engine
pub struct SttState {
    /// Audio buffer for accumulating samples during recording
    audio_buffer: Vec<f32>,
    /// Whether currently recording
    is_recording: bool,
    /// ONNX session for the preprocessor (nemo128)
    preprocessor_session: Option<Session>,
    /// ONNX session for the encoder
    encoder_session: Option<Session>,
    /// ONNX session for the decoder
    decoder_session: Option<Session>,
    /// Vocabulary: token ID -> string
    vocab: HashMap<i64, String>,
    /// Vocabulary size
    vocab_size: usize,
    /// Blank token index
    blank_idx: i64,
    /// Model status
    model_status: ModelStatus,
    /// Path to model directory
    model_dir: PathBuf,
}

impl SttState {
    pub fn new(model_dir: PathBuf) -> Self {
        let mut state = Self {
            audio_buffer: Vec::new(),
            is_recording: false,
            preprocessor_session: None,
            encoder_session: None,
            decoder_session: None,
            vocab: HashMap::new(),
            vocab_size: 0,
            blank_idx: 0,
            model_status: ModelStatus::NotDownloaded,
            model_dir,
        };

        // If models are already downloaded, load them
        if Self::are_models_downloaded(&state.model_dir) {
            if let Err(e) = state.load_models() {
                state.model_status = ModelStatus::Error { message: e };
            }
        }

        state
    }

    fn are_models_downloaded(model_dir: &PathBuf) -> bool {
        MODEL_FILES.iter().all(|file| model_dir.join(file).exists())
    }

    pub fn get_status(&self) -> SttStatus {
        SttStatus {
            model_status: self.model_status.clone(),
            is_recording: self.is_recording,
        }
    }

    pub fn start_recording(&mut self) -> Result<(), String> {
        if !matches!(self.model_status, ModelStatus::Ready) {
            return Err("Model not ready. Please download the model first.".to_string());
        }
        self.audio_buffer.clear();
        self.is_recording = true;
        Ok(())
    }

    pub fn push_audio(&mut self, samples: Vec<f32>) -> Result<(), String> {
        if !self.is_recording {
            return Err("Not recording".to_string());
        }
        self.audio_buffer.extend(samples);
        Ok(())
    }

    pub fn stop_recording(&mut self) -> Vec<f32> {
        self.is_recording = false;
        std::mem::take(&mut self.audio_buffer)
    }

    fn load_vocab(&mut self) -> Result<(), String> {
        let vocab_path = self.model_dir.join("vocab.txt");
        let content = std::fs::read_to_string(&vocab_path)
            .map_err(|e| format!("Failed to read vocab: {}", e))?;

        self.vocab.clear();
        for line in content.lines() {
            let parts: Vec<&str> = line.trim().split(' ').collect();
            if parts.len() >= 2 {
                let token = parts[0].replace('\u{2581}', " "); // Replace SentencePiece space marker
                let id: i64 = parts[1]
                    .parse()
                    .map_err(|_| format!("Invalid vocab ID: {}", parts[1]))?;
                if parts[0] == "<blk>" {
                    self.blank_idx = id;
                }
                self.vocab.insert(id, token);
            }
        }
        self.vocab_size = self.vocab.len();
        Ok(())
    }

    pub fn load_models(&mut self) -> Result<(), String> {
        if !Self::are_models_downloaded(&self.model_dir) {
            return Err("Models not downloaded".to_string());
        }

        // Load vocabulary first
        self.load_vocab()?;

        let preprocessor_path = self.model_dir.join("nemo128.onnx");
        let encoder_path = self.model_dir.join("encoder-model.onnx");
        let decoder_path = self.model_dir.join("decoder_joint-model.onnx");

        // Initialize ONNX Runtime
        ort::init()
            .with_name("opencode-stt")
            .commit()
            .map_err(|e| format!("Failed to initialize ONNX Runtime: {}", e))?;

        // Load preprocessor session
        let preprocessor_session = Session::builder()
            .map_err(|e| format!("Failed to create preprocessor session builder: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set optimization level: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set intra threads: {}", e))?
            .commit_from_file(&preprocessor_path)
            .map_err(|e| format!("Failed to load preprocessor model: {}", e))?;

        // Load encoder session
        let encoder_session = Session::builder()
            .map_err(|e| format!("Failed to create encoder session builder: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set optimization level: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set intra threads: {}", e))?
            .commit_from_file(&encoder_path)
            .map_err(|e| format!("Failed to load encoder model: {}", e))?;

        // Load decoder session
        let decoder_session = Session::builder()
            .map_err(|e| format!("Failed to create decoder session builder: {}", e))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| format!("Failed to set optimization level: {}", e))?
            .with_intra_threads(4)
            .map_err(|e| format!("Failed to set intra threads: {}", e))?
            .commit_from_file(&decoder_path)
            .map_err(|e| format!("Failed to load decoder model: {}", e))?;

        self.preprocessor_session = Some(preprocessor_session);
        self.encoder_session = Some(encoder_session);
        self.decoder_session = Some(decoder_session);
        self.model_status = ModelStatus::Ready;

        Ok(())
    }

    pub fn transcribe(&mut self, audio: &[f32]) -> Result<String, String> {
        let preprocessor = self
            .preprocessor_session
            .as_mut()
            .ok_or("Preprocessor not loaded")?;
        let encoder = self.encoder_session.as_mut().ok_or("Encoder not loaded")?;
        let decoder = self.decoder_session.as_mut().ok_or("Decoder not loaded")?;

        if audio.is_empty() {
            return Ok(String::new());
        }

        // Step 1: Preprocess audio to mel features using nemo128.onnx
        // Input: waveforms [batch, samples], waveforms_lens [batch]
        // Output: features [batch, frames, 128], features_lens [batch]
        let audio_len = audio.len() as i64;
        let waveforms: ndarray::Array2<f32> =
            ndarray::Array2::from_shape_vec((1, audio.len()), audio.to_vec())
                .map_err(|e| format!("Failed to create waveforms array: {}", e))?;
        let waveforms_lens: ndarray::Array1<i64> = ndarray::Array1::from_vec(vec![audio_len]);

        // Create input tensors
        let waveforms_tensor = ort::value::Tensor::from_array(waveforms)
            .map_err(|e| format!("Failed to create waveforms tensor: {}", e))?;
        let waveforms_lens_tensor = ort::value::Tensor::from_array(waveforms_lens)
            .map_err(|e| format!("Failed to create waveforms_lens tensor: {}", e))?;

        let preprocessor_outputs = preprocessor
            .run(ort::inputs![
                "waveforms" => waveforms_tensor,
                "waveforms_lens" => waveforms_lens_tensor
            ])
            .map_err(|e| format!("Failed to run preprocessor: {}", e))?;

        // Extract outputs
        let features_data = preprocessor_outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract features: {}", e))?;
        let features_lens_data = preprocessor_outputs[1]
            .try_extract_tensor::<i64>()
            .map_err(|e| format!("Failed to extract features_lens: {}", e))?;

        // Reconstruct arrays from shape and data
        let features_shape: Vec<usize> = features_data.0.iter().map(|&x| x as usize).collect();
        let features: ndarray::ArrayD<f32> =
            ndarray::ArrayD::from_shape_vec(features_shape.clone(), features_data.1.to_vec())
                .map_err(|e| format!("Failed to create features array: {}", e))?;
        let features_lens: ndarray::Array1<i64> =
            ndarray::Array1::from_vec(features_lens_data.1.to_vec());

        // Step 2: Encode features
        let features_tensor = ort::value::Tensor::from_array(features.clone())
            .map_err(|e| format!("Failed to create features tensor: {}", e))?;
        let features_lens_tensor = ort::value::Tensor::from_array(features_lens.clone())
            .map_err(|e| format!("Failed to create features_lens tensor: {}", e))?;

        let encoder_outputs = encoder
            .run(ort::inputs![
                "audio_signal" => features_tensor,
                "length" => features_lens_tensor
            ])
            .map_err(|e| format!("Failed to run encoder: {}", e))?;

        let encoder_out_data = encoder_outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract encoder outputs: {}", e))?;
        let encoder_lens_data = encoder_outputs[1]
            .try_extract_tensor::<i64>()
            .map_err(|e| format!("Failed to extract encoded_lengths: {}", e))?;

        let encoder_shape: Vec<usize> = encoder_out_data.0.iter().map(|&x| x as usize).collect();
        let encoder_out: ndarray::ArrayD<f32> =
            ndarray::ArrayD::from_shape_vec(encoder_shape.clone(), encoder_out_data.1.to_vec())
                .map_err(|e| format!("Failed to create encoder array: {}", e))?;
        let encoder_lens: ndarray::Array1<i64> =
            ndarray::Array1::from_vec(encoder_lens_data.1.to_vec());

        // Get encoder output shape - [batch, dim, frames]
        let encoded_dim = encoder_shape[1];
        let num_frames = encoder_shape[2];

        // Step 3: TDT Decoding
        // Initialize LSTM hidden states
        // Parakeet TDT uses 2 LSTM layers with hidden_size=640
        // State shape: [num_layers, batch_size, hidden_size]
        const NUM_LSTM_LAYERS: usize = 2;
        const LSTM_HIDDEN_SIZE: usize = 640;

        let mut state1 = ndarray::Array3::<f32>::zeros((NUM_LSTM_LAYERS, 1, LSTM_HIDDEN_SIZE));
        let mut state2 = ndarray::Array3::<f32>::zeros((NUM_LSTM_LAYERS, 1, LSTM_HIDDEN_SIZE));

        let mut tokens: Vec<i64> = Vec::new();
        let mut t = 0usize;
        let max_tokens_per_step = 10;
        let mut emitted_tokens = 0;
        let encoded_len = encoder_lens[0] as usize;

        while t < encoded_len && t < num_frames {
            // Get encoder output at frame t: shape [1, dim, 1]
            let mut encoder_frame = ndarray::Array3::<f32>::zeros((1, encoded_dim, 1));
            for d in 0..encoded_dim {
                encoder_frame[[0, d, 0]] = encoder_out[[0, d, t]];
            }

            let prev_token = if tokens.is_empty() {
                self.blank_idx as i32
            } else {
                tokens[tokens.len() - 1] as i32
            };
            let targets: ndarray::Array2<i32> =
                ndarray::Array2::from_shape_vec((1, 1), vec![prev_token])
                    .map_err(|e| format!("Failed to create targets: {}", e))?;
            let target_length: ndarray::Array1<i32> = ndarray::Array1::from_vec(vec![1i32]);

            // Create tensors for decoder
            let encoder_frame_tensor = ort::value::Tensor::from_array(encoder_frame)
                .map_err(|e| format!("Failed to create encoder_frame tensor: {}", e))?;
            let targets_tensor = ort::value::Tensor::from_array(targets)
                .map_err(|e| format!("Failed to create targets tensor: {}", e))?;
            let target_length_tensor = ort::value::Tensor::from_array(target_length)
                .map_err(|e| format!("Failed to create target_length tensor: {}", e))?;
            let state1_tensor = ort::value::Tensor::from_array(state1.clone())
                .map_err(|e| format!("Failed to create state1 tensor: {}", e))?;
            let state2_tensor = ort::value::Tensor::from_array(state2.clone())
                .map_err(|e| format!("Failed to create state2 tensor: {}", e))?;

            let decoder_outputs = decoder
                .run(ort::inputs![
                    "encoder_outputs" => encoder_frame_tensor,
                    "targets" => targets_tensor,
                    "target_length" => target_length_tensor,
                    "input_states_1" => state1_tensor,
                    "input_states_2" => state2_tensor
                ])
                .map_err(|e| format!("Failed to run decoder: {}", e))?;

            // Access outputs by name to ensure correct order
            let outputs_data = decoder_outputs["outputs"]
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("Failed to extract decoder outputs: {}", e))?;
            let new_state1_data = decoder_outputs["output_states_1"]
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("Failed to extract state1: {}", e))?;
            let new_state2_data = decoder_outputs["output_states_2"]
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("Failed to extract state2: {}", e))?;

            let outputs_flat: &[f32] = outputs_data.1;

            // TDT: first vocab_size elements are token logits, rest are duration info
            let token_logits = &outputs_flat[..self.vocab_size];
            let duration_logits = &outputs_flat[self.vocab_size..];

            // Get best token
            let token = token_logits
                .iter()
                .enumerate()
                .max_by(|(_, a): &(usize, &f32), (_, b): &(usize, &f32)| {
                    a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|(i, _)| i as i64)
                .unwrap_or(self.blank_idx);

            // Get step from duration logits (TDT specific)
            let step = if duration_logits.is_empty() {
                0
            } else {
                duration_logits
                    .iter()
                    .enumerate()
                    .max_by(|(_, a): &(usize, &f32), (_, b): &(usize, &f32)| {
                        a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
                    })
                    .map(|(i, _)| i)
                    .unwrap_or(0)
            };

            if token != self.blank_idx {
                // Update state only when emitting a token
                let state1_shape: Vec<usize> =
                    new_state1_data.0.iter().map(|&x| x as usize).collect();
                state1 = ndarray::Array3::from_shape_vec(
                    (state1_shape[0], state1_shape[1], state1_shape[2]),
                    new_state1_data.1.to_vec(),
                )
                .map_err(|e| format!("Failed to reshape state1: {}", e))?;

                let state2_shape: Vec<usize> =
                    new_state2_data.0.iter().map(|&x| x as usize).collect();
                state2 = ndarray::Array3::from_shape_vec(
                    (state2_shape[0], state2_shape[1], state2_shape[2]),
                    new_state2_data.1.to_vec(),
                )
                .map_err(|e| format!("Failed to reshape state2: {}", e))?;

                tokens.push(token);
                emitted_tokens += 1;
            }

            // Advance based on TDT step or blank/max tokens
            if step > 0 {
                t += step;
                emitted_tokens = 0;
            } else if token == self.blank_idx || emitted_tokens >= max_tokens_per_step {
                t += 1;
                emitted_tokens = 0;
            }
        }

        // Decode tokens to text
        let mut text = String::new();
        for token_id in tokens {
            if let Some(token_str) = self.vocab.get(&token_id) {
                text.push_str(token_str);
            }
        }

        // Clean up whitespace (SentencePiece style)
        let text = text.trim().split_whitespace().collect::<Vec<_>>().join(" ");

        Ok(text)
    }
}

pub type SharedSttState = Arc<Mutex<SttState>>;

/// Get the model directory path
pub fn get_model_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .resolve(
            format!("models/{}", MODEL_NAME),
            BaseDirectory::AppLocalData,
        )
        .expect("Failed to resolve model directory")
}

/// Initialize STT state
pub fn init_stt_state(app: &AppHandle) -> SharedSttState {
    let model_dir = get_model_dir(app);
    Arc::new(Mutex::new(SttState::new(model_dir)))
}

/// Download a single model file with streaming (avoids loading entire file into memory)
async fn download_file(client: &reqwest::Client, url: &str, path: &PathBuf) -> Result<(), String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download {}: HTTP {}",
            url,
            response.status()
        ));
    }

    let mut file = tokio::fs::File::create(path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;
    }

    file.flush()
        .await
        .map_err(|e| format!("Flush error: {}", e))?;

    Ok(())
}

/// Download all model files
pub async fn download_models(app: AppHandle) -> Result<(), String> {
    // Check if models are already loaded - can't overwrite memory-mapped files
    {
        let state = app.state::<SharedSttState>();
        let state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        if matches!(state.model_status, ModelStatus::Ready) && state.preprocessor_session.is_some() {
            return Ok(());
        }
    }

    let model_dir = get_model_dir(&app);

    // Create model directory
    std::fs::create_dir_all(&model_dir)
        .map_err(|e| format!("Failed to create model directory: {}", e))?;

    // Update state to downloading
    {
        let state = app.state::<SharedSttState>();
        let mut state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        state.model_status = ModelStatus::Downloading { progress: 0.0 };
    }

    let client = reqwest::Client::new();

    let total_files = MODEL_FILES.len();
    let mut downloaded = 0;

    // Download all model files
    for file in MODEL_FILES.iter() {
        let url = format!("{}/{}", HF_BASE_URL, file);
        let path = model_dir.join(file);

        // Emit progress
        let progress = (downloaded as f32) / (total_files as f32);
        app.emit("stt:download-progress", progress)
            .map_err(|e| format!("Failed to emit progress: {}", e))?;

        {
            let state = app.state::<SharedSttState>();
            let mut state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
            state.model_status = ModelStatus::Downloading { progress };
        }

        download_file(&client, &url, &path).await?;
        downloaded += 1;
    }

    // Emit completion
    app.emit("stt:download-progress", 1.0)
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Update state to ready and load models
    {
        let state = app.state::<SharedSttState>();
        let mut state = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        state.model_dir = model_dir;
        state.load_models()?;
    }

    Ok(())
}
