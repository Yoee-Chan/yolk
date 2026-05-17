"""本地凭据加密（Fernet + 机器/用户派生密钥）。"""

import base64
import hashlib
import os
import platform
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

_SALT = "yolk-jira-connector-v1"


def _derive_fernet_key() -> bytes:
    seed = "|".join(
        [
            platform.node(),
            platform.system(),
            str(os.path.expanduser("~")),
            os.environ.get("USERNAME", os.environ.get("USER", "")),
            _SALT,
        ]
    )
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(plain: str) -> str:
    if not plain:
        return ""
    f = Fernet(_derive_fernet_key())
    return f.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(cipher: str) -> Optional[str]:
    if not cipher:
        return None
    f = Fernet(_derive_fernet_key())
    try:
        return f.decrypt(cipher.encode("ascii")).decode("utf-8")
    except InvalidToken:
        return None
