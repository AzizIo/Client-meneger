from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from pydantic import BaseModel
from typing import Optional
from jose import jwt, JWTError
import bcrypt
from datetime import datetime, timedelta
from sqlalchemy import UniqueConstraint
from sqlalchemy import ForeignKey, func
from fastapi import Body
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

users = []

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/register")
def register(data: RegisterRequest):
    users.append(data)
    return {"message": "Пользователь создан"}


@app.post("/login")
def login(data: LoginRequest):
    for user in users:
        if user.email == data.email and user.password == data.password:
            return {
                "access_token": "some_token",
                "token_type": "bearer"
            }

    raise HTTPException(
        status_code=401,
        detail="Неверный email или пароль"
    )