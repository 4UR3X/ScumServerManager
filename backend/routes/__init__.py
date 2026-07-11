"""Route modules for the SCUM Manager backend.

Each submodule exposes a `router: APIRouter` that `server.py` mounts
under `/api`. Submodules are kept independent of each other (only
shared state from `app_state.py` is imported) so they can be tested
and refactored in isolation.

v1.0.37k — initial split: schema, players, diagnostics.
"""
