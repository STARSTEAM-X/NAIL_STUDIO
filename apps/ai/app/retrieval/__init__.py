"""Shared retrieval primitives for chat and recipe generation."""

from .engine import KnowledgeEntry, RetrievalEngine
from .intent import IntentRouter

__all__ = ["IntentRouter", "KnowledgeEntry", "RetrievalEngine"]
