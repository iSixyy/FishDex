import random

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.quote import Quote

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("/random")
def get_random_quote(db: Session = Depends(get_db)) -> dict:
    quotes = db.query(Quote).filter(Quote.is_active.is_(True)).all()
    if not quotes:
        return {"text": "¡Buena pesca! Vuelve pronto a por más."}
    return {"text": random.choice(quotes).text}
