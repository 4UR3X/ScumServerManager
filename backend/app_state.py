"""
Shared application state for the SCUM Manager backend.

This module exists so route modules under `routes/` can import the live
Mongo handle, app logger, and a few cross-cutting constants without
creating a circular import with `server.py`. The CONNECTION itself is
created here exactly once, and `server.py` re-uses the same `db` /
`client` references at startup.

v1.0.37k — extracted as part of the server.py modularisation refactor
(was 3850 lines monolith).
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# 3-second server-selection timeout: if MongoDB is offline, the request
# fails fast with `ServerSelectionTimeoutError` instead of hanging uvicorn
# for 30s. The global exception handler in `server.py` translates that
# error into a clean 503 response so the React UI can show the offline
# banner instead of a generic 500.
client = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=3000)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger("scum_manager")

# Constants shared across route modules
SCUM_SERVER_REQUIRED_GB = 30
SETUP_DOC_ID = "lgss-setup"
STEAM_APP_ID = "3792580"
