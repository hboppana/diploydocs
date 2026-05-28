from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    google_api_key: str = ""
    langchain_tracing_v2: bool = False
    langchain_api_key: str = ""
    langchain_project: str = "diploy-docs"
    data_dir: Path = Path("./data")

    gemini_model: str = "gemini-2.5-flash"
    embedding_model: str = "all-MiniLM-L6-v2"

    retrieval_k: int = 8
    relevance_threshold: float = 0.6
    max_query_rewrites: int = 1

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / "diploy.db"

    @property
    def chroma_path(self) -> Path:
        return self.data_dir / "chroma"


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.chroma_path.mkdir(parents=True, exist_ok=True)
