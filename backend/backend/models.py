from typing import Optional

from pydantic import BaseModel


class InfoRequest(BaseModel):
    conversation_id: Optional[str] = None
    slot: Optional[str] = None  # opsi jika ingin filter by slot waktu


class OrderRequest(BaseModel):
    conversation_id: str  # WAJIB ada dari hasil /info
    item_menu: str
    jumlah: int
    alamat_pengiriman: str
    time_window: str


class OrderConfirm(BaseModel):
    conversation_id: str


class SubstitusiRequest(BaseModel):
    conversation_id: str
    substitusi: str


class FipaMessage(BaseModel):
    timestamp: str
    sender: str
    receiver: str
    performative: str
    conversation_id: str
    content: dict
    reply_with: str = None            # Tambahkan ini
    in_reply_to: str = None           # Tambahkan ini
