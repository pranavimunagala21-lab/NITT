from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import requests
import json
import os
import hashlib
import random
from urllib.parse import quote

# DB + AUTH
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from fastapi.security import HTTPBearer

app = FastAPI()

# -----------------------------
# CORS
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# DATABASE
# -----------------------------
DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# -----------------------------
# AUTH CONFIG
# -----------------------------
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_token(data: dict):
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# -----------------------------
# MODELS
# -----------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    password = Column(String)

    projects = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    template = Column(String)
    data_json = Column(Text)
    html = Column(Text)

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="projects")

Base.metadata.create_all(bind=engine)

# -----------------------------
# DB DEPENDENCY
# -----------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -----------------------------
# AUTH ROUTES
# -----------------------------
class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str


@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(400, "User already exists")

    new_user = User(
        email=user.email,
        password=hash_password(user.password)
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created"}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(401, "Invalid credentials")

    token = create_token({"user_id": db_user.id})
    return {"access_token": token}

# -----------------------------
# AUTH USER
# -----------------------------
security = HTTPBearer()

def get_current_user(token=Depends(security), db: Session = Depends(get_db)):
    try:
        payload = decode_token(token.credentials)
        user = db.query(User).filter(User.id == payload["user_id"]).first()

        if not user:
            raise HTTPException(401, "User not found")

        return user
    except:
        raise HTTPException(401, "Invalid token")

# -----------------------------
# SCHEMAS
# -----------------------------
class Contact(BaseModel):
    phone: str = ""
    email: str = ""
    address: str = ""
    hours: str = ""

class BusinessInput(BaseModel):
    name: str
    tagline: str
    description: str
    services: List[str]
    contact: Contact

# -----------------------------
# TEMPLATE RENDER
# -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def render_template(data: BusinessInput, template_path, images=None):
    if not os.path.exists(template_path):
        return "<h1>Template not found</h1>"

    images = images or {}

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    template_name = os.path.basename(template_path)

    if template_name == "modern.html":
        services_html = "".join(
            f"<div class='service-card' contenteditable='true'>{s}</div>" for s in data.services
        )
    elif template_name == "luxury.html":
        services_html = "".join(f"<p>• {s}</p>" for s in data.services)
    else:
        services_html = "".join(f"<li contenteditable='true'>{s}</li>" for s in data.services)

    html = html.replace("{{name}}", data.name)
    html = html.replace("{{tagline}}", data.tagline)
    html = html.replace("{{description}}", data.description)
    html = html.replace("{{services}}", services_html)

    html = html.replace("{{phone}}", data.contact.phone)
    html = html.replace("{{email}}", data.contact.email)
    html = html.replace("{{address}}", data.contact.address)
    html = html.replace("{{hours}}", data.contact.hours)

    html = html.replace("{{logo}}", images.get("logo", "https://via.placeholder.com/80"))
    html = html.replace("{{hero_image}}", images.get("hero", ""))
    html = html.replace("{{about_image}}", images.get("about", ""))
    html = html.replace("{{services_image}}", images.get("services", ""))

    return html

# -----------------------------
# 🔥 LLM FUNCTION (UPGRADED)
# -----------------------------
GROQ_API_KEY = "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"

def generate_content_from_llm(user_input: str):
    prompt = f"""
You are an expert AI website generator.

Return ONLY valid JSON.
No explanations. No extra text.

Understand the business deeply.

Business idea:
{user_input}

Return JSON:

{{
  "name": "business name",
  "tagline": "short tagline",
  "description": "2-4 sentence description",
  "services": ["service1","service2","service3","service4"],
  "contact": {{
    "phone": "+91 98765 43210",
    "email": "hello@business.com",
    "address": "City, India",
    "hours": "Mon-Sat, 9AM-6PM"
  }},
  "image_keywords": {{
    "hero": "descriptive, highly visual search keywords for a premium hero background photo (e.g., 'luxury bakery interior with warm lighting')",
    "about": "descriptive, highly visual search keywords for an about section image (e.g., 'team preparing desserts in kitchen')",
    "services": "descriptive, highly visual search keywords representing the business services or products"
  }}
}}
"""

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "system", "content": "Return JSON only"},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4
        }
    )

    return response.json()["choices"][0]["message"]["content"]

# -----------------------------
# CLEAN JSON
# -----------------------------
def clean_llm_output(raw_output: str):
    try:
        start = raw_output.index("{")
        end = raw_output.rindex("}") + 1
        return json.loads(raw_output[start:end])
    except:
        return None

def stable_image_url(keyword: str, width: int, height: int, lock_seed: str):
    clean_keyword = keyword.strip() or "professional business"
    path_keyword = quote(clean_keyword.replace(" ", ","), safe=",")
    lock = int(hashlib.sha256(lock_seed.encode("utf-8")).hexdigest()[:8], 16)
    return f"https://loremflickr.com/{width}/{height}/{path_keyword}?lock={lock}"

def build_image_keywords(data: dict, idea: str):
    raw_keywords = data.get("image_keywords", {})

    if not isinstance(raw_keywords, dict):
        raw_keywords = {}

    fallback = idea.strip() or data.get("name", "professional business")

    return {
        "hero": raw_keywords.get("hero") or f"{fallback} storefront professional hero image",
        "about": raw_keywords.get("about") or f"{fallback} team at work business interior",
        "services": raw_keywords.get("services") or f"{fallback} services products professional detail",
    }

def extract_project_data_from_html(html: str):
    return {
        "images": {
            "hero": "",
            "about": "",
            "services": "",
            "logo": ""
        },
        "html_saved": bool(html)
    }

# -----------------------------
# GENERATE
# -----------------------------
@app.post("/generate-ai")
def generate_ai_website(
    user_input: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    idea = user_input.get("idea", "")
    template = user_input.get("template", "generic")

    raw_output = generate_content_from_llm(idea)
    data = clean_llm_output(raw_output)

    if not data:
        raise HTTPException(400, "Invalid AI response")

    # FIX SERVICES
    services = data.get("services", [])

    if isinstance(services, dict):
        services = list(services.keys())
    elif isinstance(services, str):
        services = [s.strip() for s in services.split(",")]

    if not isinstance(services, list) or len(services) == 0:
        services = ["Service 1", "Service 2", "Service 3"]

    data["services"] = services

    # -----------------------------
    # STABLE IMAGE GENERATION
    # -----------------------------
    image_keywords = build_image_keywords(data, idea)

    images = {
        "hero": stable_image_url(image_keywords["hero"], 1600, 600, f"{idea}-hero"),
        "about": stable_image_url(image_keywords["about"], 800, 600, f"{idea}-about"),
        "services": stable_image_url(image_keywords["services"], 800, 600, f"{idea}-services"),
        "logo": "https://via.placeholder.com/80"
    }

    data["image_keywords"] = image_keywords
    data["images"] = images

    business_data = BusinessInput(
        name=data.get("name", ""),
        tagline=data.get("tagline", ""),
        description=data.get("description", ""),
        services=data["services"],
        contact=Contact(**data.get("contact", {}))
    )

    template_path = os.path.join(BASE_DIR, "templates", f"{template}.html")
    html = render_template(business_data, template_path, images)

    return {"html": html, "data": data}

# -----------------------------
# PROJECTS
# -----------------------------
@app.get("/projects")
def get_projects(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    projects = db.query(Project).filter(Project.user_id == user.id).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "template": p.template,
            "html": p.html,
            "data_json": p.data_json
        }
        for p in projects
    ]
# -----------------------------
# SAVE PROJECT
# -----------------------------
@app.post("/save-project")
def save_project(
    data: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    project = Project(
        name=data["name"],
        template=data["template"],
        html=data["html"],
        data_json=json.dumps(data.get("data") or extract_project_data_from_html(data["html"])),
        user_id=user.id
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return {"message": "Project saved", "project_id": project.id}

# -----------------------------
# UPDATE PROJECT
# -----------------------------
@app.put("/update-project")
def update_project(
    data: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == data["project_id"],
        Project.user_id == user.id
    ).first()

    if not project:
        raise HTTPException(403, "Unauthorized")

    project.html = data["html"]

    if "data" in data:
        try:
            existing = json.loads(project.data_json) if project.data_json else {}
        except:
            existing = {}

        existing.update(data["data"])
        project.data_json = json.dumps(existing)

    db.commit()

    return {"message": "Updated successfully"}
#--------------------------------------
#DELETE PROJECT
#----------------------------------
@app.delete("/delete-project/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id
    ).first()

    if not project:
        raise HTTPException(404, "Project not found")

    db.delete(project)
    db.commit()

    return {"message": "Project deleted"}

# -----------------------------
# PUBLISHED WEBSITE
# -----------------------------
@app.get("/published/{project_id}", response_class=HTMLResponse)
def published_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(404, "Project not found")

    return HTMLResponse(content=project.html)

# -----------------------------
# ROOT
# -----------------------------
@app.get("/")
def root():
    return {"message": "Backend running 🚀"}
