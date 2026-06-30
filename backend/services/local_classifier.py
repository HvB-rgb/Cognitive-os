import os
import joblib
from sklearn.pipeline import Pipeline
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import TfidfVectorizer
from backend.models.schemas import AIProcessingResult
import re

MODEL_PATH = "backend/models/classifier.joblib"
MIN_SAMPLES = 30


class LocalClassifier:
    def __init__(self):
        self.pipeline = None
        self.trained = False
        self.training_samples = 0
        self._load_if_exists()

    def _load_if_exists(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.pipeline = joblib.load(MODEL_PATH)
                self.trained = True
                print("[Classifier] Loaded existing model from disk")
            except Exception as e:
                print(f"[Classifier] Failed to load model: {e}")

    def train(self, texts: list[str], buckets: list[str]):
        if len(texts) < MIN_SAMPLES:
            print(f"[Classifier] Not enough data ({len(texts)}/{MIN_SAMPLES})")
            return False

        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(
                max_features=2000,
                ngram_range=(1, 2),
                stop_words="english",
                min_df=1,
            )),
            ("classifier", MultinomialNB(alpha=0.1))
        ])

        self.pipeline.fit(texts, buckets)
        self.trained = True
        self.training_samples = len(texts)

        os.makedirs("backend/models", exist_ok=True)
        joblib.dump(self.pipeline, MODEL_PATH)
        print(f"[Classifier] Trained on {len(texts)} samples, saved to disk")
        return True

    def predict(self, text: str) -> tuple[str, float]:
        if not self.trained or not self.pipeline:
            return None, 0.0

        try:
            probabilities = self.pipeline.predict_proba([text])[0]
            classes = self.pipeline.classes_
            best_idx = probabilities.argmax()
            best_bucket = classes[best_idx]
            confidence = float(probabilities[best_idx])
            return best_bucket, confidence
        except Exception as e:
            print(f"[Classifier] Prediction failed: {e}")
            return None, 0.0

    @property
    def is_ready(self) -> bool:
        return self.trained and self.pipeline is not None


# Singleton
classifier = LocalClassifier()