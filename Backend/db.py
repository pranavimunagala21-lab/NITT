import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")

client = MongoClient(MONGODB_URI)

db = client["ai_website_builder"]

users_collection    = db["users"]
projects_collection = db["projects"]
otp_collection      = db["otps"]
