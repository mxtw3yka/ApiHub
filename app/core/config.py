from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    DB_URL: str = Field(..., alias="DB_URL")
    APP_HOST: str = '0.0.0.0'
    APP_PORT: int = 8000
    GITHUB_TOKEN: str = ''
    REDIS_URL: str = 'redis://localhost:6379/0'
    CACHE_TTL_SECONDS: int = 60
    LOG_LEVEL: str = 'INFO'
    model_config = {'env_file': 'app/.env', 'case_sensitive': False}

settings = Settings()