from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    service_account_file: str
    secret_key: str
    sync_hour: int = 2
    sync_minute: int = 0

    class Config:
        env_file = ".env"


settings = Settings()
