from fastapi import status
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError
from app_config import AppConfig
from app_db import AppDB


class AppLogin:

    def __init__(self, conf: AppConfig):
        self._pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.conf = conf

    def verify_password(self, plain_password, hashed_password):
        return self._pwd_context.verify(plain_password, hashed_password)

    def get_pw_hash(self, password):
        return self._pwd_context.hash(password)

    def authenticate_user(self, db: AppDB, username: str, password: str):
        user_hash = db.get_user_hash(username)
        if user_hash is None:
            return False
        if not self.verify_password(password, user_hash):
            return False
        return True

    def create_jwt_token(self, data: dict):
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(
                    minutes=self.conf.get_expire_min)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
                to_encode,
                self.conf.get_secret_key,
                algorithm=self.conf.get_algorithms
        )
        return encoded_jwt

    def set_token_with_cookie(self, dic, response):
        new_access_token = self.create_jwt_token(
                dic
        )
        response.set_cookie(
            key="access_token",
            value=f"Bearer {new_access_token}",
            httponly=True,
            secure=self.conf.get_secure_cookie,
            samesite="lax",
            max_age=self.conf.get_expire_min,
        )
        response.status_code = status.HTTP_200_OK
        return response

    def is_current_user(self, token):
        try:
            payload = jwt.decode(
                    token,
                    self.conf.get_secret_key,
                    algorithms=[self.conf.get_algorithms])
            username: str = payload.get("sub")
            if username is None:
                return False
            return True
        except JWTError:
            return False
