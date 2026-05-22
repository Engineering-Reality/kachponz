from dotenv import load_dotenv, find_dotenv
import os
import torch
import warnings

# Suppress warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

# from transformers import AutoTokenizer, CLIPModel, AutoProcessor
import numpy as np
from PIL import Image

load_dotenv(find_dotenv())

class EmbedderService:
    """
    Embedding service using CLIP model for both text and image embeddings.
    Uses the full CLIP model to support both modalities.
    (Currently disabled due to torchvision compatibility issues)
    """
    
    def __init__(self):
        self._init_embedding_model()

    def _init_embedding_model(self):
        """Initialize the CLIP model (DISABLED)."""
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.clip_model_id = "openai/clip-vit-large-patch14"
        print("⚠️ CLIP model for embeddings is currently DISABLED (commented out).")
        
        # self.processor = AutoProcessor.from_pretrained(self.clip_model_id)
        # self.image_processor = self.processor.image_processor
        # self.tokenizer = self.processor.tokenizer
        
        # self.clip_model = CLIPModel.from_pretrained(
        #     self.clip_model_id, 
        #     torch_dtype=torch.bfloat16
        # ).to(self.device)
        # self.clip_model.eval()
        # print(f"✅ CLIP embedding model ready on device: {self.device}")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Mock implementation returning zero vectors."""
        print(f"⚠️ [MOCK] Boosting zeros for {len(texts)} docs (CLIP disabled)")
        return [[0.0] * 768 for _ in texts]

    def embed_query(self, query: str) -> list[float]:
        """Mock implementation returning zero vector."""
        # print(f"⚠️ [MOCK] Boosting zeros for query (CLIP disabled)")
        return [0.0] * 768

    def embed_image(self, image_path: str) -> list[float]:
        """Mock implementation returning zero vector."""
        print(f"⚠️ [MOCK] Boosting zeros for image: {image_path} (CLIP disabled)")
        return [0.0] * 768

    @property
    def embedding_dim(self) -> int:
        """Get the dimension of the embeddings (Hardcoded to 768)."""
        return 768
    

if __name__ == "__main__":
    embedder = EmbedderService()
    print(f"Mock Embedding Dim: {embedder.embedding_dim}")