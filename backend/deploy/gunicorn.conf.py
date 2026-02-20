import multiprocessing
import os


bind = os.getenv("VAPOR_BIND", "0.0.0.0:8100")
workers = int(os.getenv("VAPOR_WORKERS", str(max(2, multiprocessing.cpu_count() // 2))))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = int(os.getenv("VAPOR_WORKER_CONNECTIONS", "1000"))
timeout = int(os.getenv("VAPOR_WORKER_TIMEOUT", "60"))
graceful_timeout = int(os.getenv("VAPOR_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("VAPOR_KEEPALIVE", "5"))
accesslog = "-"
errorlog = "-"
capture_output = True
loglevel = os.getenv("VAPOR_LOG_LEVEL", "info").lower()
