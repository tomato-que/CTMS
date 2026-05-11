"""CTMS AI Service Configuration"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ctms-ai-service"
    debug: bool = False

    # Java API callback
    java_api_base_url: str = "http://localhost:8080"
    java_api_callback_path: str = "/api/v1/ocr/callback"
    callback_retry_max: int = 3
    callback_retry_delay: int = 5

    # RabbitMQ
    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_pass: str = "guest"
    ocr_request_queue: str = "ctms.ocr.request"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_raw_bucket: str = "ctms-raw"
    minio_processed_bucket: str = "ctms-processed"

    # OpenSearch
    opensearch_hosts: str = "http://localhost:9200"
    opensearch_user: str = "admin"
    opensearch_pass: str = "admin"
    opensearch_index_kb: str = "idx_knowledge_base"

    # Model settings
    embedding_model_name: str = "BAAI/bge-large-zh-v1.5"

    # LLM
    llm_api_base: str | None = None
    llm_api_key: str | None = None
    llm_model_name: str = "default"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
