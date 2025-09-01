from sqlmodel import Field, SQLModel, create_engine, Session

class ConversationLog(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    timestamp: str
    sender: str
    receiver: str
    performative: str
    conversation_id: str
    content: str # WAJIB string!

sqlite_url = "sqlite:///conversation_logs.db"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
