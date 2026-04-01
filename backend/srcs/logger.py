import logging
import sys
from srcs.config import get_settings


class AppLogger(logging.Logger):
    """
    A specialized Logger for the application that inherits from logging.Logger.
    It encapsulates independent level control and high-performance routing to stdout.
    """
    def __init__(self, name: str = "srcs"):
        super().__init__(name)
        self.propagate = False  # Isolate from the root logger to avoid third-party noise
        
        # Configure level based on application settings
        settings = get_settings()
        level = logging.DEBUG if settings.DEBUG else logging.INFO
        self.setLevel(level)

        # Attach a dedicated StreamHandler with professional formatting
        handler = logging.StreamHandler(sys.stderr)
        handler.setLevel(level)

        formatter = logging.Formatter(
            fmt='[%(levelname)1.1s] [%(name)s] %(message)s'
        )
        handler.setFormatter(formatter)
        
        if self.hasHandlers():
            self.handlers.clear()
        
        self.addHandler(handler)

logger = AppLogger("srcs")
logger.info("AppLogger initialized at level: %s", logging.getLevelName(logger.level))
