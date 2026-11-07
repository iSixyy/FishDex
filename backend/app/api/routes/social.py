"""Reacciones (me gusta) y comentarios sobre capturas.

Va aparte de `feed.py` porque estas rutas cuelgan de `/captures/...` y
`/comments/...`, no de `/feed`.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.social import CommentCreate, CommentPublic
from app.services import social_service
from app.services.user_service import to_user_public

router = APIRouter(tags=["social"])


def _to_comment_public(comment) -> CommentPublic:
    return CommentPublic(id=comment.id, user=to_user_public(comment.user), text=comment.text, created_at=comment.created_at)


@router.post("/captures/{capture_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_capture(capture_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    social_service.like_capture(db, user, capture_id)


@router.delete("/captures/{capture_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_capture(capture_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    social_service.unlike_capture(db, user, capture_id)


@router.get("/captures/{capture_id}/comments", response_model=list[CommentPublic])
def list_comments(
    capture_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CommentPublic]:
    comments = social_service.list_comments(db, user, capture_id, limit, offset)
    return [_to_comment_public(c) for c in comments]


@router.post("/captures/{capture_id}/comments", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
def create_comment(
    capture_id: int, payload: CommentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> CommentPublic:
    comment = social_service.create_comment(db, user, capture_id, payload.text)
    return _to_comment_public(comment)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    social_service.delete_comment(db, user, comment_id)
