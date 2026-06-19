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