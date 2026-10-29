import os
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, List, Optional
from backend.app.config import settings, ROOT_DIR

class BaseStorage(ABC):
    @abstractmethod
    def list_keys(self, prefix: str = "") -> List[str]:
        """List keys matching prefix."""
        pass

    @abstractmethod
    def open(self, key: str) -> BinaryIO:
        """Stream open file in binary read mode."""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Check if key exists."""
        pass

    @abstractmethod
    def put(self, key: str, file_obj: BinaryIO) -> str:
        """Save file to storage and return key."""
        pass

    @abstractmethod
    def get_range(self, key: str, start: int, end: int) -> bytes:
        """Get byte range of file for HTTP Range requests."""
        pass

    @abstractmethod
    def get_file_size(self, key: str) -> int:
        """Get total file size in bytes."""
        pass


class LocalStorage(BaseStorage):
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.PDF_DIR).resolve()

    def _resolve(self, key: str) -> Path:
        target = (self.base_dir / key).resolve()
        # Allow files anywhere within base_dir or root project dir
        if not str(target).startswith(str(self.base_dir)) and not str(target).startswith(str(ROOT_DIR)):
            raise ValueError(f"Access denied: path outside storage root ({key})")
        return target

    def list_keys(self, prefix: str = "") -> List[str]:
        keys = []
        search_root = self.base_dir
        if prefix:
            prefix_path = self.base_dir / prefix
            if prefix_path.is_dir():
                search_root = prefix_path

        # Recursively scan for PDF files
        for root, _, files in os.walk(search_root):
            for file in files:
                if file.lower().endswith(".pdf"):
                    full_p = Path(root) / file
                    try:
                        rel = full_p.relative_to(self.base_dir)
                        keys.append(str(rel).replace("\\", "/"))
                    except ValueError:
                        keys.append(str(full_p).replace("\\", "/"))
        return sorted(keys)

    def open(self, key: str) -> BinaryIO:
        path = self._resolve(key)
        return open(path, "rb")

    def exists(self, key: str) -> bool:
        try:
            return self._resolve(key).is_file()
        except Exception:
            return False

    def put(self, key: str, file_obj: BinaryIO) -> str:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        return key

    def get_range(self, key: str, start: int, end: int) -> bytes:
        path = self._resolve(key)
        with open(path, "rb") as f:
            f.seek(start)
            length = (end - start) + 1
            return f.read(length)

    def get_file_size(self, key: str) -> int:
        path = self._resolve(key)
        return path.stat().st_size


class R2Storage(BaseStorage):
    def __init__(self):
        import boto3
        self.bucket = settings.R2_BUCKET
        self.prefix = settings.R2_PREFIX or ""
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        )

    def list_keys(self, prefix: str = "") -> List[str]:
        keys = []
        full_prefix = f"{self.prefix}/{prefix}".strip("/")
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=full_prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.lower().endswith(".pdf"):
                    keys.append(key)
        return sorted(keys)

    def open(self, key: str) -> BinaryIO:
        # Stream from R2
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"]

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    def put(self, key: str, file_obj: BinaryIO) -> str:
        self.client.upload_fileobj(file_obj, self.bucket, key)
        return key

    def get_range(self, key: str, start: int, end: int) -> bytes:
        range_header = f"bytes={start}-{end}"
        response = self.client.get_object(Bucket=self.bucket, Key=key, Range=range_header)
        return response["Body"].read()

    def get_file_size(self, key: str) -> int:
        response = self.client.head_object(Bucket=self.bucket, Key=key)
        return int(response["ContentLength"])


def get_storage() -> BaseStorage:
    if settings.PDF_SOURCE.lower() == "r2":
        return R2Storage()
    return LocalStorage()
