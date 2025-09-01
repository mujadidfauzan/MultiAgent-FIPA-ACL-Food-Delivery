from datetime import datetime
import uuid

def make_fipa_message(
        sender, receiver, performative, content, conversation_id=None,
        reply_with=None, in_reply_to=None
    ):
    return {
        "timestamp": datetime.now().isoformat(),
        "sender": sender,
        "receiver": receiver,
        "performative": performative,
        "conversation_id": conversation_id or str(uuid.uuid4()),
        "content": content,
        "reply_with": reply_with,
        "in_reply_to": in_reply_to,
    }