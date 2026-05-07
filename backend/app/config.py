from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    # Base64-encoded contents of the GCP service account JSON key
    service_account_b64: str
    secret_key: str
    sync_hour: int = 2
    sync_minute: int = 0

    class Config:
        env_file = ".env"


settings = Settings()
