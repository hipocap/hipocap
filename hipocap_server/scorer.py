"""
Scorer module for calculating injection scores.
Can be used independently or as part of the analyzer.
"""

import torch
from torch.nn.functional import softmax
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import Optional, List
import os


class Scorer:
    """
    Lightweight scorer for indirect prompt injection detection.
    Can be used independently for scoring text without full analysis.
    """
    
    def __init__(
        self,
        model_id: str = "meta-llama/Prompt-Guard-86M",
        device: str = "cuda",
        temperature: float = 1.0,
        hf_token: Optional[str] = None
    ):
        """
        Initialize the Scorer.
        
        Args:
            model_id: HuggingFace model ID for the prompt guard model
            device: Device to run the model on ('cpu' or 'cuda')
            temperature: Temperature for softmax scaling
            hf_token: HuggingFace token for accessing private/gated models (or set HF_TOKEN env var)
        """
        self.model_id = model_id
        
        # Auto-detect device if CUDA requested but not available
        if device == "cuda":
            try:
                import torch
                if not torch.cuda.is_available():
                    device = "cpu"
                    print("[Scorer] CUDA not available, using CPU instead")
            except Exception:
                device = "cpu"
                print("[Scorer] Error checking CUDA, using CPU instead")
        
        self.device = device
        self.temperature = temperature
        
        # Get HuggingFace token from parameter or environment
        token = hf_token or os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
        
        # Load model and tokenizer with token if provided
        load_kwargs = {}
        if token:
            load_kwargs["token"] = token
        
        # Progress logging for model download
        print("[Hipocap Server] ========================================")
        print("[Hipocap Server] Downloading Prompt Guard Model")
        print(f"[Hipocap Server] Model: {model_id}")
        print(f"[Hipocap Server] Device: {device}")
        print("[Hipocap Server] This may take a few minutes on first startup...")
        print("[Hipocap Server] ========================================")
        
        print("[Hipocap Server] [1/3] Downloading tokenizer...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, **load_kwargs)
        print("[Hipocap Server] [1/3] ✓ Tokenizer downloaded successfully")
        
        print("[Hipocap Server] [2/3] Downloading model weights...")
        print("[Hipocap Server] [2/3] (This is the largest step - please wait...)")
        self.model = AutoModelForSequenceClassification.from_pretrained(model_id, **load_kwargs)
        print("[Hipocap Server] [2/3] ✓ Model weights downloaded successfully")
        
        print(f"[Hipocap Server] [3/3] Moving model to device ({device})...")
        self.model.to(device)
        self.model.eval()
        print("[Hipocap Server] [3/3] ✓ Model loaded and ready")
        print("[Hipocap Server] ========================================")
        print("[Hipocap Server] ✓ Prompt Guard model initialization complete!")
    
    def score(self, text: str) -> float:
        """
        Calculate the indirect injection score for the given text.
        
        Args:
            text: Text to evaluate
            
        Returns:
            Score between 0 and 1 (higher = more likely to be injection)
        """
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        ).to(self.device)
        
        with torch.no_grad():
            logits = self.model(**inputs).logits
        
        scaled_logits = logits / self.temperature
        probabilities = softmax(scaled_logits, dim=-1)
        
        # Dynamic class detection: Prompt Guard model can be binary (2 classes) or multi-class (3+ classes)
        num_classes = probabilities.shape[1]
        if num_classes >= 3:
            # Multi-class model: combine probabilities for malicious (class 1) and embedded instructions (class 2)
            score = (probabilities[0, 1] + probabilities[0, 2]).item()
        else:
            # Binary classifier: only use class 1 (malicious)
            score = probabilities[0, 1].item()
        return score
    
    def batch_score(self, texts: List[str]) -> List[float]:
        """
        Score multiple texts in a batch.
        
        Args:
            texts: List of texts to evaluate
            
        Returns:
            List of scores (one per text)
        """
        return [self.score(text) for text in texts]

