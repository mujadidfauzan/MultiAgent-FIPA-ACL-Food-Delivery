import json
import uuid
from threading import Lock

from database import ConversationLog, create_db_and_tables, engine
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fipa import make_fipa_message
from models import InfoRequest, OrderConfirm, OrderRequest, SubstitusiRequest
from sqlmodel import Session

app = FastAPI(on_startup=[create_db_and_tables])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Bisa diganti dengan daftar domain frontend kamu
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_session():
    with Session(engine) as session:
        yield session


ORDER_COUNTER = 1
order_lock = Lock()
ITEMS_AVAILABLE = {"Pizza Margherita": 2, "Burger": 5, "Nasi Goreng": 3}
SLOT_BOOKED = {}  # format: {'12:00-13:00': jumlah}


# Helper: get latest reply_with for a given conversation_id and performative
def get_latest_reply_with(conversation_id, session, performative="request"):
    latest = (
        session.query(ConversationLog)
        .filter(
            ConversationLog.conversation_id == conversation_id,
            ConversationLog.performative == performative,
        )
        .order_by(ConversationLog.id.desc())
        .first()
    )
    if latest and hasattr(latest, "reply_with"):
        return getattr(latest, "reply_with", None)
    # fallback to possible field in content
    try:
        c = json.loads(latest.content)
        return c.get("reply_with", None)
    except:
        return None


# Endpoint 1: Customer requests menu info
@app.post("/info")
def info_menu(info_req: InfoRequest, session: Session = Depends(get_session)):
    global ORDER_COUNTER
    conversation_id = info_req.conversation_id or f"info{ORDER_COUNTER:05d}"
    reply_with = str(uuid.uuid4())
    customer_request = make_fipa_message(
        "Customer",
        "Provider",
        "request",
        {"type": "menu_info", "slot_filter": info_req.slot},
        conversation_id,
        reply_with=reply_with,
    )
    session.add(
        ConversationLog(
            **{**customer_request, "content": json.dumps(customer_request["content"])}
        )
    )

    opsi = []
    for item, stok in ITEMS_AVAILABLE.items():
        opsi.append(
            {
                "item_menu": item,
                "stok": stok,
                "estimasi_waktu": (
                    "45 menit" if item == "Pizza Margherita" else "35-50 menit"
                ),
                "biaya_pengiriman": 5000.0,
            }
        )

    # Provider's reply references reply_with
    provider_response = make_fipa_message(
        "Provider",
        "Customer",
        "inform",
        {"opsi": opsi},
        conversation_id,
        in_reply_to=reply_with,
    )
    session.add(
        ConversationLog(
            **{**provider_response, "content": json.dumps(provider_response["content"])}
        )
    )
    session.commit()
    ORDER_COUNTER += 1
    return {"conversation_id": conversation_id, "provider_response": provider_response}


# Endpoint 2: Customer requests order (Happy + Error Path)
@app.post("/order")
def order_food(order: OrderRequest, session: Session = Depends(get_session)):
    with order_lock:
        conversation_id = order.conversation_id
        reply_with = str(uuid.uuid4())
        msg_request = make_fipa_message(
            "Customer",
            "Provider",
            "request",
            order.dict(),
            conversation_id,
            reply_with=reply_with,
        )
        session.add(
            ConversationLog(
                **{**msg_request, "content": json.dumps(msg_request["content"])}
            )
        )
        item = order.item_menu
        n = order.jumlah
        slot = order.time_window

        # Error Path: slot penuh
        if slot in SLOT_BOOKED and (SLOT_BOOKED[slot] + n > 5):
            response = {"alasan": f"Slot waktu {slot} penuh"}
            msg_disconfirm = make_fipa_message(
                "Provider",
                "Customer",
                "disconfirm",
                response,
                conversation_id,
                in_reply_to=reply_with,
            )
            session.add(
                ConversationLog(
                    **{
                        **msg_disconfirm,
                        "content": json.dumps(msg_disconfirm["content"]),
                    }
                )
            )
            session.commit()
            return {
                "conversation_id": conversation_id,
                "provider_response": msg_disconfirm,
            }

        # Error Path: stok habis, tawarkan semua substitusi
        if ITEMS_AVAILABLE.get(item, 0) < n:
            substitusi_list = [
                k for k, v in ITEMS_AVAILABLE.items() if v >= n and k != item
            ]
            if substitusi_list:
                response = {"substitusi": substitusi_list}
            else:
                response = {"substitusi": "Tidak ada substitusi tersedia"}
            msg_disconfirm = make_fipa_message(
                "Provider",
                "Customer",
                "disconfirm",
                response,
                conversation_id,
                in_reply_to=reply_with,
            )
            session.add(
                ConversationLog(
                    **{
                        **msg_disconfirm,
                        "content": json.dumps(msg_disconfirm["content"]),
                    }
                )
            )
            session.commit()
            return {
                "conversation_id": conversation_id,
                "provider_response": msg_disconfirm,
            }

        # Happy Path
        ITEMS_AVAILABLE[item] -= n
        SLOT_BOOKED[slot] = SLOT_BOOKED.get(slot, 0) + n
        response = {
            "item_menu": item,
            "jumlah": n,
            "estimasi_waktu": (
                "45 menit" if item == "Pizza Margherita" else "35-50 menit"
            ),
            "biaya_pengiriman": 5000.0,
            "alamat_pengiriman": order.alamat_pengiriman,
            "time_window": slot,
        }
        msg_inform = make_fipa_message(
            "Provider",
            "Customer",
            "confirm",
            response,
            conversation_id,
            in_reply_to=reply_with,
        )
        session.add(
            ConversationLog(
                **{**msg_inform, "content": json.dumps(msg_inform["content"])}
            )
        )
        session.commit()
        return {"conversation_id": conversation_id, "provider_response": msg_inform}


# Endpoint 3: Customer confirms order
@app.post("/order/confirm")
def confirm_order(confirm: OrderConfirm, session: Session = Depends(get_session)):
    reply_with = str(uuid.uuid4())
    customer_confirm = make_fipa_message(
        "Customer",
        "Provider",
        "confirm",
        {"action": "customer_confirm"},
        confirm.conversation_id,
        reply_with=reply_with,
    )
    session.add(
        ConversationLog(
            **{**customer_confirm, "content": json.dumps(customer_confirm["content"])}
        )
    )

    nomor_order = confirm.conversation_id.upper()
    response = {
        "nomor_order": nomor_order,
        "status": "confirmed",
        "payment_status": "pending",
    }
    # Provider's reply references customer's confirm
    provider_final = make_fipa_message(
        "Provider",
        "Customer",
        "inform",
        response,
        confirm.conversation_id,
        in_reply_to=reply_with,
    )
    session.add(
        ConversationLog(
            **{**provider_final, "content": json.dumps(provider_final["content"])}
        )
    )
    session.commit()
    return {"conversation_id": confirm.conversation_id, "provider_response": response}


# Endpoint 4: Customer picks substitution on error path
@app.post("/order/substitute")
def substitute_order(
    substitusi_req: SubstitusiRequest, session: Session = Depends(get_session)
):
    reply_with = str(uuid.uuid4())
    msg_request = make_fipa_message(
        "Customer",
        "Provider",
        "request",
        {"substitusi": substitusi_req.substitusi},
        substitusi_req.conversation_id,
        reply_with=reply_with,
    )
    session.add(
        ConversationLog(
            **{**msg_request, "content": json.dumps(msg_request["content"])}
        )
    )
    # Find original request for jumlah & slot
    last_order = (
        session.query(ConversationLog)
        .filter(
            ConversationLog.conversation_id == substitusi_req.conversation_id,
            ConversationLog.performative == "request",
            ConversationLog.content.contains(
                "item_menu"
            ),  # Pastikan ini adalah log pesanan
        )
        .order_by(ConversationLog.id.desc())  # Ambil yang paling baru
        .first()
    )
    print(f"Last order: {last_order}")
    if not last_order:
        response = {"alasan": "Order asli tidak ditemukan"}
        msg_disconfirm = make_fipa_message(
            "Provider",
            "Customer",
            "disconfirm",
            response,
            substitusi_req.conversation_id,
            in_reply_to=reply_with,
        )
        session.add(
            ConversationLog(
                **{**msg_disconfirm, "content": json.dumps(msg_disconfirm["content"])}
            )
        )
        session.commit()
        return {
            "conversation_id": substitusi_req.conversation_id,
            "provider_response": response,
        }
    prev_content = json.loads(last_order.content)
    print(f"Previous content: {prev_content}")
    n = prev_content.get("jumlah", 1)
    slot = prev_content.get("time_window", "")
    alamat = prev_content.get("alamat_pengiriman", "")  # <-- TAMBAHKAN BARIS INI
    item = substitusi_req.substitusi
    if ITEMS_AVAILABLE.get(item, 0) < n or (
        slot in SLOT_BOOKED and SLOT_BOOKED[slot] + n > 5
    ):
        response = {"alasan": "Substitusi juga tidak tersedia"}
        msg_disconfirm = make_fipa_message(
            "Provider",
            "Customer",
            "disconfirm",
            response,
            substitusi_req.conversation_id,
            in_reply_to=reply_with,
        )
        session.add(
            ConversationLog(
                **{**msg_disconfirm, "content": json.dumps(msg_disconfirm["content"])}
            )
        )
        session.commit()

        return {
            "conversation_id": substitusi_req.conversation_id,
            "provider_response": response,
        }
    ITEMS_AVAILABLE[item] -= n
    SLOT_BOOKED[slot] = SLOT_BOOKED.get(slot, 0) + n
    response = {
        "item_menu": item,
        "jumlah": n,
        "estimasi_waktu": "55 menit",
        "biaya_pengiriman": 5000.0,
        "alamat_pengiriman": alamat,  # <-- TAMBAHKAN BARIS INI
        "time_window": slot,
    }
    msg_inform = make_fipa_message(
        "Provider",
        "Customer",
        "inform",
        response,
        substitusi_req.conversation_id,
        in_reply_to=reply_with,
    )
    session.add(
        ConversationLog(**{**msg_inform, "content": json.dumps(msg_inform["content"])})
    )
    session.commit()

    print(f"Response: {response}")

    return {
        "conversation_id": substitusi_req.conversation_id,
        "provider_response": response,
    }


# Endpoint 5: Log all conversation
@app.get("/logs")
def get_logs(session: Session = Depends(get_session)):
    logs = session.query(ConversationLog).all()
    return [
        {
            "timestamp": l.timestamp,
            "sender": l.sender,
            "receiver": l.receiver,
            "performative": l.performative,
            "conversation_id": l.conversation_id,
            "content": json.loads(l.content),
            "reply_with": getattr(l, "reply_with", None),
            "in_reply_to": getattr(l, "in_reply_to", None),
        }
        for l in logs
    ]


# Endpoint 6: Get specific conversation by ID
@app.get("/logs/{conversation_id}")
def get_conversation(conversation_id: str, session: Session = Depends(get_session)):
    logs = (
        session.query(ConversationLog)
        .filter(ConversationLog.conversation_id == conversation_id)
        .all()
    )
    return [
        {
            "timestamp": l.timestamp,
            "sender": l.sender,
            "receiver": l.receiver,
            "performative": l.performative,
            "conversation_id": l.conversation_id,
            "content": json.loads(l.content),
            "reply_with": getattr(l, "reply_with", None),
            "in_reply_to": getattr(l, "in_reply_to", None),
        }
        for l in logs
    ]
