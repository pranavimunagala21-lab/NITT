from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import logging
import requests
import json
import os
import hashlib
import random
import re
import smtplib
import ssl
from html import escape
from urllib.parse import quote
from email.message import EmailMessage
from dotenv import load_dotenv
load_dotenv()

# DB + AUTH
from bson import ObjectId
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from fastapi.security import HTTPBearer
from db import db, users_collection, projects_collection, otp_collection
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

@app.on_event("startup")
def seed_admin():
    try:
        print("MongoDB database:", db.name)
        print("MongoDB users collection:", users_collection.name)

        admin_email = "admin@nitt.edu"
        admin_password = "admin123"
        hashed_pwd = hash_password(admin_password)

        existing = users_collection.find_one({"email": admin_email})
        if not existing:
            # Create fresh admin account
            users_collection.insert_one({
                "name":       "Admin",
                "email":      admin_email,
                "password":   hashed_pwd,
                "language":   "en",
                "is_admin":   True,
                "created_at": datetime.utcnow().timestamp(),
            })
            logger.info("Admin user created: %s / %s", admin_email, admin_password)
        else:
            # Always sync password so admin123 always works
            users_collection.update_one(
                {"email": admin_email},
                {"$set": {"password": hashed_pwd, "is_admin": True}},
            )
            logger.info("Admin password synced: %s / %s", admin_email, admin_password)

    except Exception as e:
        logger.error("Error seeding admin: %s", e)

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

# -----------------------------
# AUTH CONFIG
# -----------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
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

def serialize_user(user: dict):
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "language": user.get("language", "en"),
        "is_admin": user.get("is_admin", False),
        "role": "admin" if user.get("is_admin", False) else "user",
    }

def send_otp(email: str, otp: str) -> bool:
    """Send OTP email. Returns True if sent, False if skipped (dev mode / no SMTP creds)."""
    print("SEND OTP FUNCTION CALLED")
    print("EMAIL:", email)
    print("OTP:", otp)

    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()
    smtp_host = "smtp.gmail.com"
    smtp_port = 587

    print("SMTP_HOST:", smtp_host)
    print("SMTP_PORT:", smtp_port)
    print("SMTP_USER_SET:", bool(smtp_user))
    print("SMTP_PASS_LEN:", len(smtp_pass))

    if not smtp_user or not smtp_pass:
        print("EMAIL SKIPPED (dev mode):")
        print("SMTP_USER / SMTP_PASS not set.")
        print(f"[DEV OTP] {email}: {otp}")
        return False

    msg = EmailMessage()
    msg["From"] = smtp_user
    msg["To"] = email
    msg["Subject"] = "OTP Verification"
    msg.set_content(f"Your OTP is: {otp}")

    try:
        context = ssl.create_default_context()
        print("Connecting to SMTP server...")
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            print("Connected to SMTP")
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            print("Logging in...")
            server.login(smtp_user, smtp_pass)
            print("Login successful")
            print("Sending email...")
            server.send_message(msg)
            print("Email sent successfully")
        return True
    except Exception as e:
        import traceback
        print("EMAIL ERROR:")
        traceback.print_exc()
        print(f"[DEV OTP] {email}: {otp}")
        return False

# -----------------------------
# AUTH ROUTES
# -----------------------------
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    aadhaar: str
    pan: str
    tin: Optional[str] = None
    brn: Optional[str] = None
    language: str = "en"  # NEW FIELD — "en" or "te"

class UserLogin(BaseModel):
    email: str
    password: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


# ─── PAN Validation ─────────────────────────────────────────────────────────
def is_valid_pan(pan: str) -> bool:
    """Validate Indian PAN format: 5 uppercase letters + 4 digits + 1 uppercase letter."""
    pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
    return bool(re.match(pattern, pan))


@app.post("/signup")
def signup(user: UserCreate):
    print("Signup route hit")
    email = user.email.strip().lower()
    logger.info("Signup request received for %s", email)

    # ── Normalize & validate PAN ──────────────────────────────────────────────
    user.pan = user.pan.strip().upper()
    if not is_valid_pan(user.pan):
        raise HTTPException(
            status_code=400,
            detail="Invalid PAN format. Expected format: ABCDE1234F (5 letters + 4 digits + 1 letter, uppercase)."
        )

    try:
        existing = users_collection.find_one({"email": email})
        otp = str(random.randint(100000, 999999))
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        print("Generated OTP:", otp)

        if existing:
            users_collection.update_one(
                {"email": email},
                {"$set": {"is_verified": False, "updated_at": datetime.utcnow().timestamp()}},
            )
        else:
            hashed_password = hash_password(user.password)
            users_collection.insert_one(
                {
                    "name": user.name.strip(),
                    "email": email,
                    "password": hashed_password,
                    "aadhaar": user.aadhaar.strip(),
                    "pan": user.pan,
                    "tin": user.tin.strip() if user.tin else None,
                    "brn": user.brn.strip() if user.brn else None,
                    "language": user.language or "en",
                    "is_verified": False,
                    "is_admin": False,
                    "created_at": datetime.utcnow().timestamp(),
                }
            )
            print("User stored in MongoDB")

        # Store OTP in otp_collection (upsert by email)
        otp_collection.update_one(
            {"email": email},
            {"$set": {
                "otp": otp,
                "expires_at": expires_at,
                "attempts": 0,
                "created_at": datetime.utcnow(),
            }},
            upsert=True,
        )

        print("Calling send_otp...")
        email_sent = send_otp(email, otp)
        resp = {"message": "OTP sent", "email": email}
        if not email_sent:
            resp["dev_otp"] = otp  # Include OTP in dev mode for testing
        return resp
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Signup failed for %s", email)
        raise HTTPException(status_code=500, detail=f"Signup failed: {exc}")

@app.get("/test-email")
def test_email():
    test_recipient = os.getenv("TEST_EMAIL", "").strip()
    if not test_recipient:
        raise HTTPException(status_code=400, detail="Set TEST_EMAIL env var to the recipient address to test.")
    send_otp(test_recipient, "123456")
    return {"message": "Test email sent"}

@app.post("/verify-otp")
def verify_otp(payload: VerifyOtpRequest):
    email = payload.email.strip().lower()
    otp = (payload.otp or "").strip()

    if not otp:
        raise HTTPException(status_code=400, detail="OTP is required")

    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_verified"):
        otp_collection.delete_one({"email": email})
        return {"message": "Already verified"}

    otp_doc = otp_collection.find_one({"email": email})
    if not otp_doc:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new one.")

    # Check expiry
    if datetime.utcnow() > otp_doc["expires_at"]:
        otp_collection.delete_one({"email": email})
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if str(otp_doc.get("otp")) != otp:
        # Increment attempts
        otp_collection.update_one({"email": email}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True}},
    )
    otp_collection.delete_one({"email": email})
    return {"message": "OTP verified"}


@app.post("/send-otp")
def send_otp_endpoint(payload: dict):
    """Send a fresh OTP to the given email (if user exists)."""
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    otp_collection.update_one(
        {"email": email},
        {"$set": {"otp": otp, "expires_at": expires_at, "attempts": 0, "created_at": datetime.utcnow()}},
        upsert=True,
    )

    print(f"[SEND-OTP] Generated OTP for {email}: {otp}")
    email_sent = send_otp(email, otp)
    resp = {"message": "OTP sent", "email": email}
    if not email_sent:
        resp["dev_otp"] = otp
    return resp


@app.post("/resend-otp")
def resend_otp(payload: dict):
    """Resend a new OTP, overwriting the previous one. Used for the resend button."""
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("is_verified"):
        return {"message": "Already verified"}

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    otp_collection.update_one(
        {"email": email},
        {"$set": {"otp": otp, "expires_at": expires_at, "attempts": 0, "created_at": datetime.utcnow()}},
        upsert=True,
    )

    print(f"[RESEND-OTP] New OTP for {email}: {otp}")
    email_sent = send_otp(email, otp)
    resp = {"message": "OTP resent", "email": email}
    if not email_sent:
        resp["dev_otp"] = otp
    return resp


@app.post("/login")
def login(user: UserLogin):
    email = user.email.strip().lower()
    db_user = users_collection.find_one({"email": email})

    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not db_user.get("is_verified", True):
        raise HTTPException(status_code=403, detail="Please verify OTP first")

    token = create_token({"user_id": str(db_user["_id"])})
    return {"access_token": token, "user": serialize_user(db_user)}

# -----------------------------
# AUTH USER
# -----------------------------
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)   # does NOT raise 401 when missing

def get_current_user(token=Depends(security)):
    """Strict auth – raises 401 when token is absent or invalid."""
    try:
        payload = decode_token(token.credentials)
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = users_collection.find_one({"_id": ObjectId(user_id)})

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return serialize_user(user)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_optional_user(token=Depends(security_optional)):
    """Soft auth – returns user dict when a valid token is provided,
    or None when no / invalid token is sent.  Never raises 401."""
    if token is None:
        return None
    try:
        payload = decode_token(token.credentials)
        user_id = payload.get("user_id")
        if not user_id:
            return None
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        return serialize_user(user) if user else None
    except Exception:
        return None

@app.get("/me")
def get_me(user=Depends(get_current_user)):
    return user

@app.delete("/user/delete")
def delete_current_user(user=Depends(get_current_user)):
    users_collection.delete_one({"_id": ObjectId(user["id"])})
    projects_collection.delete_many({"user_id": user["id"]})
    return {"message": "Account deleted successfully"}

# -----------------------------
# ADMIN ROUTES
# -----------------------------
def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@app.get("/admin/users")
def get_all_users(admin=Depends(require_admin)):
    users = list(users_collection.find({}, {"password": 0}).sort("created_at", -1))
    result = []
    for u in users:
        user_id_str = str(u["_id"])
        project_count = projects_collection.count_documents({"user_id": user_id_str})

        # created_at may be a float (unix timestamp), a datetime, or missing — always emit ISO string
        raw_ts = u.get("created_at")
        if raw_ts is None:
            created_at_str = ""
        elif isinstance(raw_ts, (int, float)):
            try:
                created_at_str = datetime.utcfromtimestamp(raw_ts).strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                created_at_str = ""
        elif hasattr(raw_ts, "isoformat"):
            created_at_str = raw_ts.isoformat()
        else:
            created_at_str = str(raw_ts)

        result.append({
            "id":            user_id_str,
            "name":          u.get("name",     ""),
            "email":         u.get("email",    ""),
            "language":      u.get("language", "en"),
            "is_admin":      u.get("is_admin", False),
            "role":          "admin" if u.get("is_admin", False) else "user",
            "created_at":    created_at_str,
            "project_count": project_count,
        })

    return {"total_users": len(result), "users": result}

@app.get("/admin/stats")
def get_admin_stats(admin=Depends(require_admin)):
    total_users    = users_collection.count_documents({})
    total_projects = projects_collection.count_documents({})
    recent_cursor  = users_collection.find({}, {"password": 0}).sort("created_at", -1).limit(5)
    recent_users   = []
    for u in recent_cursor:
        raw_ts = u.get("created_at")
        if isinstance(raw_ts, (int, float)):
            ts_str = datetime.utcfromtimestamp(raw_ts).strftime("%Y-%m-%dT%H:%M:%SZ")
        elif hasattr(raw_ts, "isoformat"):
            ts_str = raw_ts.isoformat()
        else:
            ts_str = ""
        recent_users.append({
            "id":       str(u["_id"]),
            "name":     u.get("name",     ""),
            "email":    u.get("email",    ""),
            "is_admin": u.get("is_admin", False),
            "language": u.get("language", "en"),
            "created_at": ts_str,
        })
    return {
        "total_users":    total_users,
        "total_projects": total_projects,
        "recent_users":   recent_users,
    }

@app.delete("/admin/delete-user/{id}")
def delete_user(id: str, admin=Depends(require_admin)):
    try:
        user_oid = ObjectId(id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    deleted = users_collection.delete_one({"_id": user_oid})
    if deleted.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    projects_collection.delete_many({"user_id": id})
    return {"message": "User deleted successfully"}


# -----------------------------
# SCHEMAS
# -----------------------------
class Contact(BaseModel):
    phone: str = ""
    email: str = ""
    address: str = ""
    hours: str = ""
    whatsapp: str = ""
    map_query: str = ""
    instagram: str = ""
    twitter: str = ""
    youtube: str = ""

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
STATIC_DIR = os.path.join(BASE_DIR, "static")
VALID_TEMPLATES = {"generic", "modern", "luxury", "creative"}
LEGACY_TEMPLATE_MAP = {
    "basic": "generic",
    "elegant": "luxury",
    "bold": "modern",
}

def resolve_template_path(template_name: str):
    selected_template = (template_name or "generic").strip().lower()
    selected_template = LEGACY_TEMPLATE_MAP.get(selected_template, selected_template)
    if selected_template not in VALID_TEMPLATES:
        logger.warning("Invalid template '%s', falling back to generic", selected_template)
        selected_template = "generic"

    template_path = os.path.join(BASE_DIR, "templates", f"{selected_template}.html")
    logger.info("Selected template: %s", selected_template)
    logger.info("Template file path: %s", template_path)

    if os.path.exists(template_path):
        return selected_template, template_path

    fallback_path = os.path.join(BASE_DIR, "templates", "generic.html")
    logger.warning("Template file missing for '%s', falling back to %s", selected_template, fallback_path)

    if os.path.exists(fallback_path):
        return "generic", fallback_path

    logger.error("Generic fallback template is missing: %s", fallback_path)
    raise HTTPException(status_code=500, detail="No valid template file found")

def build_initials_logo(name: str):
    clean_name = (name or "AI Website").strip()
    initials = "".join(part[0] for part in clean_name.split()[:2]).upper() or "AI"
    colors = ["#2d6df7", "#7d39ff", "#0f766e", "#9f1239", "#ea580c"]
    color_index = int(hashlib.sha256(clean_name.encode("utf-8")).hexdigest()[:2], 16) % len(colors)
    svg = f"""
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none">
  <rect width="160" height="160" rx="40" fill="{colors[color_index]}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        fill="white" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="700">{escape(initials)}</text>
</svg>
"""
    return f"data:image/svg+xml;utf8,{quote(svg)}"

def build_services_markup(template_name: str, services: List[str], service_images: List[str]) -> str:
    service_items = services[:3] if services else ["Custom Solutions", "Expert Delivery", "Client Support"]
    service_images = (service_images or [])[:3]
    while len(service_images) < len(service_items):
        service_images.append(service_images[-1] if service_images else "")

    # Common onerror handler for service card images – falls back to picsum
    _onerror = "this.onerror=null;this.src='https://picsum.photos/seed/fallback/400/300';"

    if template_name == "creative":
        return "".join(
            (
                "<article class='creative-card'>"
                f"<div class='card-index'>{index:02d}</div>"
                f"<img src='{escape(service_images[index - 1])}' alt='{escape(service)}' class='creative-card-image editable-img' onerror=\"{_onerror}\" />"
                "<div class='card-content'>"
                f"<h3 class='editable'>{escape(service)}</h3>"
                "<p>Designed with innovation, bold artistic touch, and bespoke execution.</p>"
                "</div>"
                "</article>"
            )
            for index, service in enumerate(service_items, start=1)
        )

    if template_name == "modern":
        return "".join(
            (
                "<article class='feature-card'>"
                f"<span>{index:02d}</span>"
                f"<img src='{escape(service_images[index - 1])}' alt='{escape(service)}' class='feature-card-image editable-img' onerror=\"{_onerror}\" />"
                f"<h3 class='editable'>{escape(service)}</h3>"
                "<p>Structured to feel high-growth, product-led, and ready for scale.</p>"
                "</article>"
            )
            for index, service in enumerate(service_items, start=1)
        )

    if template_name == "luxury":
        return "".join(
            (
                "<div class='service-line'>"
                f"<span>{index:02d}</span>"
                f"<img src='{escape(service_images[index - 1])}' alt='{escape(service)}' class='service-thumb editable-img' onerror=\"{_onerror}\" />"
                f"<span class='editable'>{escape(service)}</span>"
                "</div>"
            )
            for index, service in enumerate(service_items, start=1)
        )

    return "".join(
        (
            "<article class='service-card'>"
            f"<span>{index:02d}</span>"
            f"<img src='{escape(service_images[index - 1])}' alt='{escape(service)}' class='service-card-image editable-img' onerror=\"{_onerror}\" />"
            "<div>"
            f"<h3>{escape(service)}</h3>"
            "<p>Presented with clarity for a polished and trustworthy first impression.</p>"
            "</div>"
            "</article>"
        )
        for index, service in enumerate(service_items, start=1)
    )

def build_contact_links(data: BusinessInput) -> str:
    """Build clickable action links (phone, WhatsApp, Maps, social)."""
    c = data.contact
    phone = (c.phone or "").strip()
    whatsapp = (c.whatsapp or phone or "").strip()
    address = (c.address or "").strip()
    map_query = (c.map_query or address or f"{data.name}").strip()
    instagram = (c.instagram or "").strip()
    twitter = (c.twitter or "").strip()
    youtube = (c.youtube or "").strip()

    links = []
    if phone:
        links.append(f'<a class="btn btn-call" href="tel:{escape(phone)}">\U0001f4de Call</a>')
    if whatsapp:
        wa_num = re.sub(r"[^0-9+]", "", whatsapp)
        links.append(f'<a class="btn btn-wa" href="https://wa.me/{escape(wa_num)}" target="_blank">\U0001f4ac WhatsApp</a>')
    if map_query:
        links.append(f'<a class="btn btn-map" href="https://www.google.com/maps/search/{escape(map_query)}" target="_blank">\U0001f4cd Location</a>')
    if instagram:
        links.append(f'<a class="btn btn-ig" href="{escape(instagram)}" target="_blank">\U0001f4f8 Instagram</a>')
    if twitter:
        links.append(f'<a class="btn btn-tw" href="{escape(twitter)}" target="_blank">\U0001f426 Twitter</a>')
    if youtube:
        links.append(f'<a class="btn btn-yt" href="{escape(youtube)}" target="_blank">\u25b6\ufe0f YouTube</a>')

    return '<div class="contact-links">' + "".join(links) + '</div>'

def render_template(data: BusinessInput, template_name: str, template_path: str, images=None):
    if not os.path.exists(template_path):
        raise HTTPException(status_code=500, detail="Template file not found")

    images = images or {}

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    hero_url     = images.get("hero", "")
    about_url    = images.get("about", "")
    services_url = images.get("services", "")
    # Final guard: never inject a non-URL (e.g. plain text) into the HTML
    if not _is_valid_image_url(hero_url):
        hero_url = _picsum_fallback(1200, 600)
    if not _is_valid_image_url(about_url):
        about_url = _picsum_fallback(800, 500)
    if not _is_valid_image_url(services_url):
        services_url = _picsum_fallback(800, 500)

    replacements = {
        "name": escape(data.name or ""),
        "tagline": escape(data.tagline or ""),
        "description": escape(data.description or ""),
        "services": build_services_markup(template_name, data.services, images.get("service_cards", [])),
        "phone": escape(data.contact.phone or ""),
        "email": escape(data.contact.email or ""),
        "address": escape(data.contact.address or ""),
        "hours": escape(data.contact.hours or ""),
        "logo": images.get("logo", "/nit-trichy-logo.png"),
        "hero_image": hero_url,
        "about_image": about_url,
        "services_image": services_url,
        "contact_links": build_contact_links(data),
    }

    rendered = re.sub(
        r"\{\{\s*(\w+)\s*\}\}",
        lambda match: replacements.get(match.group(1), ""),
        html,
    )

    # Inject a script that handles broken/missing images gracefully for ALL img tags
    img_fallback_script = r"""<script>
(function(){
  function handleImgError(img){
    var w=img.getAttribute('data-fw')||800,h=img.getAttribute('data-fh')||600;
    img.onerror=null;
    img.src='https://picsum.photos/seed/'+encodeURIComponent(img.alt||'fallback')+'/'+w+'/'+h;
  }
  function checkImg(img){
    // Reject empty src or src that is just the page URL (no real image set)
    var src=(img.src||'').trim();
    if(!src||src===location.href||src===window.location.origin+'/'){
      handleImgError(img); return;
    }
    // Reject plain-text descriptions mistakenly set as src
    if(!src.startsWith('http')&&!src.startsWith('data:')&&!src.startsWith('/')){
      handleImgError(img); return;
    }
    img.addEventListener('error',function(){handleImgError(img);},{once:true});
  }
  // Run after DOM is ready
  function init(){
    document.querySelectorAll('img').forEach(checkImg);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
</script>"""

    rendered_with_script = rendered.replace('</body>', img_fallback_script + '</body>')
    # Always inject preview mode for iframe display
    return apply_preview_mode(rendered_with_script)

def apply_preview_mode(html: str) -> str:
    """Ensure the rendered HTML has body.preview class for the iframe preview."""
    if not html:
        return html

    def set_preview_class(match):
        attrs = match.group(1) or ""
        class_match = re.search(r'class="([^"]*)"', attrs)
        if class_match:
            classes = class_match.group(1).split()
            # Replace preview/published with just 'preview'
            classes = [c for c in classes if c not in ("published", "preview")]
            classes.append("preview")
            new_class_attr = f'class="{" ".join(classes)}"'
            return f'<body{attrs.replace(class_match.group(0), new_class_attr, 1)}>'
        return f'<body{attrs} class="preview">'

    return re.sub(r"<body([^>]*)>", set_preview_class, html, count=1)

def apply_published_mode(html: str):
    """Swap body class to 'published' — removes 'preview' to prevent conflicts."""
    if not html:
        return html

    def set_published_class(match):
        attrs = match.group(1) or ""
        class_match = re.search(r'class="([^"]*)"', attrs)
        if class_match:
            classes = class_match.group(1).split()
            # Remove preview, ensure published is present
            classes = [c for c in classes if c not in ("preview", "published")]
            classes.append("published")
            new_class_attr = f'class="{" ".join(classes)}"'
            return f'<body{attrs.replace(class_match.group(0), new_class_attr, 1)}>'
        return f'<body{attrs} class="published">'

    return re.sub(r"<body([^>]*)>", set_published_class, html, count=1)

@app.get("/nit-trichy-logo.png")
def get_nit_trichy_logo():
    logo_path = os.path.join(STATIC_DIR, "nit-trichy-logo.png")
    if not os.path.exists(logo_path):
        raise HTTPException(status_code=404, detail="Logo file not found")
    return FileResponse(logo_path, media_type="image/png")

# -----------------------------
# 🔥 LLM FUNCTION (UPGRADED)
# -----------------------------
import os
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
print("API KEY:", GROQ_API_KEY)

def fallback_business_payload(user_input: str):
    clean_idea = re.sub(r"\s+", " ", (user_input or "").strip())
    words = clean_idea.split()
    business_name = " ".join(word.capitalize() for word in words[:3]) or "Business Studio"
    slug = re.sub(r'[^a-z0-9]+', '', business_name.lower()) or 'business'
    address = f"{clean_idea or business_name}, India"
    phone = "+91 98765 43210"
    return {
        "name": business_name,
        "tagline": f"Premium Solutions for You",
        "description": f"{business_name} delivers exceptional customer-focused service with a commitment to quality and trust.",
        "services": [
            {"title": "Custom Solutions", "description": "Tailored services designed for your unique needs."},
            {"title": "Expert Delivery", "description": "Professional execution with attention to detail."},
            {"title": "Ongoing Support", "description": "Reliable assistance whenever you need it."}
        ],
        "contact": {
            "phone": phone,
            "email": f"hello@{slug}.com",
            "address": address,
            "hours": "Mon-Sat, 9AM-6PM",
            "whatsapp": phone,
            "map_query": address,
        },
        "images": {
            "hero": f"https://source.unsplash.com/1200x600/?{'+'.join(words[:3] or ['professional'])}+business",
            "about": f"https://source.unsplash.com/800x600/?{'+'.join(words[:3] or ['team'])}+workspace",
            "services": f"https://source.unsplash.com/800x600/?{'+'.join(words[:3] or ['service'])}+quality",
        },
    }


def generate_content_from_llm(user_input: str):
    _EXAMPLE = '{"name":"Golden Crust Bakery","tagline":"Artisan Breads and Pastries","description":"Handcrafted baked goods made fresh daily with premium ingredients. Serving the community since 2010.","services":[{"title":"Custom Cakes","description":"Beautiful celebration cakes for your special moments."},{"title":"Fresh Pastries","description":"Croissants and danishes baked every morning."},{"title":"Catering Orders","description":"Large orders for events and gatherings."}],"contact":{"phone":"+91 98765 43210","email":"hello@goldencrust.com","address":"Anna Nagar, Chennai","hours":"Mon-Sat, 7AM-8PM","whatsapp":"+91 98765 43210","map_query":"Anna Nagar, Chennai"},"images":{"hero":"https://source.unsplash.com/1200x600/?bakery+artisan+bread","about":"https://source.unsplash.com/800x600/?baker+kitchen+pastries","services":"https://source.unsplash.com/800x600/?cake+decoration+bakery"}}'

    prompt = (
        "You are a professional website content generator.\n"
        "Return ONLY valid JSON. No markdown. No explanation. No extra text.\n\n"
        "STRICT RULES:\n"
        '- "name": Business name, max 3 words, title case.\n'
        '- "tagline": Hero headline, max 8 words, punchy and specific. NEVER say "Welcome".\n'
        '- "description": About section, exactly 2 short sentences, max 20 words total.\n'
        '- "services": Array of EXACTLY 3 objects with "title" (max 4 words) and "description" (1 short sentence, max 12 words).\n'
        '- "contact.phone": Realistic Indian phone "+91 XXXXX XXXXX".\n'
        '- "contact.email": Professional email based on business name.\n'
        '- "contact.address": Realistic city matching business context.\n'
        '- "contact.hours": Simple like "Mon-Sat, 9AM-6PM".\n'
        '- "contact.whatsapp": SAME as phone.\n'
        '- "contact.map_query": SAME as address.\n'
        '- "images.hero": https://source.unsplash.com/1200x600/?keyword1+keyword2 (2-3 SPECIFIC keywords, NOT generic).\n'
        '- "images.about": https://source.unsplash.com/800x600/?keyword1+keyword2 (different relevant keywords).\n'
        '- "images.services": https://source.unsplash.com/800x600/?keyword1+keyword2 (service-relevant keywords).\n\n'
        "NEVER use generic image keywords like 'business', 'office', 'company' alone.\n"
        "NEVER leave any field empty or null. Use sensible defaults.\n\n"
        f"EXAMPLE:\n{_EXAMPLE}\n\n"
        f"Now generate for this business:\n{user_input}\n\n"
        "Return ONLY the JSON object. Nothing else."
    )


    if not GROQ_API_KEY:
        return json.dumps(fallback_business_payload(user_input))

    try:
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
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception:
        logger.exception("Falling back to deterministic business content")
        return json.dumps(fallback_business_payload(user_input))

# -----------------------------
# CLEAN JSON
# -----------------------------
def clean_llm_output(raw_output: str):
    """Extract valid JSON from LLM response, handling markdown fences and extra text."""
    if not raw_output or not isinstance(raw_output, str):
        return None
    # Strip markdown code fences if present
    cleaned = raw_output.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()
    # Try to parse directly first
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        pass
    # Try to find JSON object within the text
    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        return json.loads(cleaned[start:end])
    except (ValueError, json.JSONDecodeError):
        return None

# ─────────────────────────────────────────────────────────────────────────────
# IMAGE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

# Business-type → curated visual keywords for each section
# Using a tiered dict: each entry has hero / about / services keywords.
_BUSINESS_KEYWORD_MAP = [
    # Hotels / hospitality
    (["hotel", "resort", "hospitality", "inn", "motel", "lodge", "spa"],
     {"hero": "luxury hotel lobby interior",
      "about": "hotel concierge team service",
      "services": "hotel room elegant suite"}),
    # Restaurants / food
    (["restaurant", "cafe", "bakery", "bistro", "dining", "food", "catering", "kitchen"],
     {"hero": "fine dining restaurant interior elegant",
      "about": "chef preparing gourmet food kitchen",
      "services": "restaurant food plating dessert"}),
    # Gym / fitness
    (["gym", "fitness", "yoga", "pilates", "crossfit", "sport", "athletics", "wellness"],
     {"hero": "modern gym fitness equipment",
      "about": "personal trainer coaching session",
      "services": "gym workout equipment weights"}),
    # Beauty / salon
    (["beauty", "salon", "spa", "nail", "hair", "cosmetic", "skincare", "makeup"],
     {"hero": "luxury beauty salon interior",
      "about": "beauty treatment hairstyle professional",
      "services": "cosmetic skincare products beauty"}),
    # Law / legal
    (["law", "legal", "attorney", "lawyer", "firm", "counsel", "advocate"],
     {"hero": "law office professional interior",
      "about": "lawyers professional team meeting",
      "services": "legal documents court professional"}),
    # Real estate
    (["real estate", "property", "realty", "housing", "apartment", "home"],
     {"hero": "modern luxury real estate architecture",
      "about": "real estate agent professional meeting",
      "services": "luxury house interior modern design"}),
    # Tech / software / startup
    (["tech", "software", "startup", "saas", "app", "digital", "ai", "cloud", "data"],
     {"hero": "modern tech startup office",
      "about": "software developers working team",
      "services": "technology dashboard interface modern"}),
    # Fashion / clothing
    (["fashion", "clothing", "apparel", "boutique", "design", "tailor", "textile"],
     {"hero": "luxury fashion boutique interior",
      "about": "fashion designer studio creative",
      "services": "clothing fashion collection elegant"}),
    # Medical / health
    (["medical", "clinic", "hospital", "health", "doctor", "dental", "pharmacy", "nurse"],
     {"hero": "modern medical clinic professional",
      "about": "doctors team medical professional",
      "services": "medical equipment healthcare modern"}),
    # Education
    (["school", "college", "education", "academy", "tutoring", "learning", "coaching"],
     {"hero": "modern school campus education",
      "about": "teacher students classroom professional",
      "services": "education books classroom learning"}),
    # Finance
    (["finance", "bank", "investment", "insurance", "accounting", "audit", "tax"],
     {"hero": "professional finance office modern",
      "about": "financial advisors team professional",
      "services": "finance charts investment professional"}),
    # Events
    (["event", "wedding", "photography", "video", "production", "entertainment"],
     {"hero": "elegant event venue decoration",
      "about": "event team planning professional",
      "services": "wedding photography event decoration"}),
]


def _detect_business_keywords(name: str, idea: str) -> dict:
    """Return curated image search keywords based on detected business type.
    Falls back to the raw idea if no category matches."""
    combined = (name + " " + idea).lower()
    for triggers, kw_map in _BUSINESS_KEYWORD_MAP:
        if any(t in combined for t in triggers):
            return kw_map
    # No match — derive sensible keywords from the idea itself
    base = " ".join((name + " " + idea).split()[:5]).strip() or "professional business"
    return {
        "hero":     f"{base} professional exterior",
        "about":    f"{base} team office workspace",
        "services": f"{base} service product detail",
    }


def stable_image_url(keyword: str, width: int = 800, height: int = 600):
    """Generate a deterministic, keyword-seeded image URL using Picsum Photos.
    Same keyword always produces the same image. Extremely reliable."""
    clean_keyword = keyword.strip() or "professional business"
    # Build a short, URL-safe seed from the keyword
    short_keyword = "+".join(clean_keyword.split()[:5])
    seed = quote(short_keyword)
    # picsum.photos/seed/{seed}/{width}/{height} is deterministic & reliable
    return f"https://picsum.photos/seed/{seed}/{width}/{height}"


def generate_auto_images(business_name: str, description: str, image_keywords: dict):
    """Generate context-aware image URLs when the user does NOT upload images.
    Uses business name + description + LLM-suggested keywords for relevance.
    Each section gets a unique, keyword-targeted image URL."""
    # Build a concise keyword base from business context
    base = f"{business_name} {description}".strip()
    search_base = " ".join(base.split()[:6]) or "professional business"

    # Per-section keywords – prefer LLM-suggested, fallback to derived
    hero_kw     = image_keywords.get("hero")     or f"{search_base} storefront professional"
    about_kw    = image_keywords.get("about")    or f"{search_base} team workspace"
    services_kw = image_keywords.get("services") or f"{search_base} service detail"

    result = {
        "hero_image":     stable_image_url(hero_kw, 1200, 600),
        "about_image":    stable_image_url(about_kw + " about", 800, 500),
        "services_image": stable_image_url(services_kw + " services", 800, 500),
        "service_cards": [
            stable_image_url(f"{services_kw} card{i}", 400, 300)
            for i in range(1, 4)
        ],
    }

    logger.info("AUTO-IMAGES generated: hero=%s  about=%s  services=%s",
                result["hero_image"], result["about_image"], result["services_image"])
    print(f"[AUTO-IMAGES] hero={result['hero_image']}")
    print(f"[AUTO-IMAGES] about={result['about_image']}")
    print(f"[AUTO-IMAGES] services={result['services_image']}")

    return result


def _is_valid_image_url(value: str) -> bool:
    """Return True only when value is a real HTTP/HTTPS URL."""
    if not isinstance(value, str):
        return False
    v = value.strip()
    return v.startswith("http://") or v.startswith("https://")


def _sanitize_llm_images(llm_images: dict) -> dict:
    """Drop any LLM image value that is not a real URL (e.g. plain text descriptions).
    Falls back to an empty string so downstream code uses Picsum auto-images."""
    sanitized = {}
    for key in ("hero", "about", "services"):
        raw = (llm_images or {}).get(key, "")
        if _is_valid_image_url(raw):
            sanitized[key] = raw.strip()
        else:
            if raw:  # only log when there was a non-empty bad value
                print(f"[SANITIZE-IMAGES] Rejected non-URL LLM image for '{key}': {repr(raw)}")
            sanitized[key] = ""
    return sanitized


def _picsum_fallback(width: int = 800, height: int = 600) -> str:
    """Reliable fallback image from Picsum Photos (always works, random photos)."""
    return f"https://picsum.photos/seed/fallback/{width}/{height}"

def clean_business_value(value: str, fallback: str):
    text = (value or "").strip()
    banned = {
        "welcome to our site",
        "insert description here",
        "lorem ipsum",
        "your business",
    }
    if not text or text.lower() in banned:
        return fallback
    return text

def build_image_keywords(data: dict, idea: str):
    """Build final image search keywords.
    Priority: context-detected curated keywords > LLM-suggested keywords > fallback."""
    raw_keywords = data.get("image_keywords", {})
    if not isinstance(raw_keywords, dict):
        raw_keywords = {}

    name = data.get("name", "")

    # 1. Try to match a known business category for curated, relevant keywords
    detected = _detect_business_keywords(name, idea)

    # 2. Use curated > LLM-suggested > fallback
    fallback = idea.strip() or name or "professional business"
    return {
        "hero":     detected["hero"]     or raw_keywords.get("hero")     or f"{fallback} professional exterior",
        "about":    detected["about"]    or raw_keywords.get("about")    or f"{fallback} team at work interior",
        "services": detected["services"] or raw_keywords.get("services") or f"{fallback} service product detail",
    }

def resolve_images(user_input: dict, business_name: str, image_keywords: dict, idea: str):
    """Resolve images for the website.
    Priority: user-uploaded > LLM-provided Unsplash URLs > auto-generated Picsum.
    NEVER returns empty image URLs — always provides a working fallback."""
    raw_images = user_input.get("images") if isinstance(user_input.get("images"), list) else []
    uploaded_images = [img for img in raw_images if isinstance(img, str) and img.strip()]
    uploaded_logo = user_input.get("logo") if isinstance(user_input.get("logo"), str) else ""

    # LLM-provided image URLs — sanitize to ensure only real URLs are used
    raw_llm_images = user_input.get("_llm_images") or {}
    llm_images = _sanitize_llm_images(raw_llm_images)

    print(f"[RESOLVE-IMAGES] uploaded_count={len(uploaded_images)} has_logo={bool(uploaded_logo)} has_llm_images={bool(llm_images)}")

    # Generate auto images based on business context (Picsum fallback)
    auto = generate_auto_images(business_name, idea, image_keywords)

    # Resolve hero image
    if uploaded_images:
        hero_image = uploaded_images[0]
    elif llm_images.get("hero"):
        hero_image = llm_images["hero"]
    else:
        hero_image = auto["hero_image"]

    # Resolve about image
    if len(uploaded_images) > 1:
        about_image = uploaded_images[1]
    elif uploaded_images:
        about_image = uploaded_images[0]
    elif llm_images.get("about"):
        about_image = llm_images["about"]
    else:
        about_image = auto["about_image"]

    # Resolve service card images
    service_cards = []
    for index in range(3):
        uploaded_index = index + 2
        if len(uploaded_images) > uploaded_index:
            service_cards.append(uploaded_images[uploaded_index])
        elif uploaded_images:
            service_cards.append(uploaded_images[min(index, len(uploaded_images) - 1)])
        elif llm_images.get("services") and index == 0:
            service_cards.append(llm_images["services"])
        else:
            service_cards.append(auto["service_cards"][index])

    # Final safety net — replace any remaining non-URL with a Picsum fallback
    def _safe_url(v, w, h):
        return v if _is_valid_image_url(v) else _picsum_fallback(w, h)

    result = {
        "hero": _safe_url(hero_image, 1200, 600),
        "about": _safe_url(about_image, 800, 500),
        "services": _safe_url(service_cards[0] if service_cards else "", 800, 500),
        "service_cards": [_safe_url(u, 400, 300) for u in service_cards] if service_cards else [_picsum_fallback(400, 300) for _ in range(3)],
        "logo": uploaded_logo or build_initials_logo(business_name),
        "hero_image": _safe_url(hero_image, 1200, 600),
        "about_image": _safe_url(about_image, 800, 500),
        "services_image": _safe_url(service_cards[0] if service_cards else "", 800, 500),
    }

    print(f"[RESOLVE-IMAGES] final hero={result['hero_image']}")
    print(f"[RESOLVE-IMAGES] final about={result['about_image']}")
    print(f"[RESOLVE-IMAGES] final services={result['services_image']}")

    return result

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
@app.get("/generate-ai")
def generate_ai_info():
    """Helpful message when the endpoint is opened in a browser (GET)."""
    return {
        "message": "Use a POST request to generate a website.",
        "example_body": {"idea": "bakery in Chennai", "template": "modern"},
    }

@app.post("/generate-ai")
def generate_ai_website(
    user_input: dict,
    user=Depends(get_optional_user)      # auth is OPTIONAL – works without a token
):
    print("[GENERATE-AI] endpoint called")
    print(f"[GENERATE-AI] caller={'authenticated:' + user['email'] if user else 'anonymous'}")
    print(f"[GENERATE-AI] input keys={list(user_input.keys())}")

    idea = user_input.get("idea", "")
    requested_template = user_input.get("template", "generic")
    template, template_path = resolve_template_path(requested_template)

    raw_output = generate_content_from_llm(idea)
    data = clean_llm_output(raw_output)

    # ——— FAILSAFE: always produce valid data even when LLM fails ———
    if not data:
        logger.warning("[GENERATE-AI] LLM returned bad JSON – using fallback payload")
        data = fallback_business_payload(idea)

    # FIX SERVICES — handle objects {title, description}, strings, dicts, or CSV
    raw_services = data.get("services", [])
    service_titles = []
    service_descriptions = []

    if isinstance(raw_services, list):
        for item in raw_services[:3]:
            if isinstance(item, dict):
                title = clean_business_value(item.get("title", ""), "")
                desc = item.get("description", "") or ""
                if title:
                    service_titles.append(title)
                    service_descriptions.append(desc.strip()[:80])
            elif isinstance(item, str) and item.strip():
                service_titles.append(item.strip())
                service_descriptions.append("")
    elif isinstance(raw_services, dict):
        for k, v in list(raw_services.items())[:3]:
            service_titles.append(clean_business_value(k, "Premium Service"))
            service_descriptions.append(str(v)[:80] if v else "")
    elif isinstance(raw_services, str):
        for s in raw_services.split(",")[:3]:
            if s.strip():
                service_titles.append(s.strip())
                service_descriptions.append("")

    # Fallback if empty
    if not service_titles:
        service_titles = ["Custom Solutions", "Expert Delivery", "Customer Support"]
        service_descriptions = ["Tailored for your needs", "Professional execution", "Reliable support"]

    # Pad to exactly 3 if needed
    while len(service_titles) < 3:
        service_titles.append("Premium Service")
        service_descriptions.append("Quality solutions for your business")

    # Truncate service titles to max 5 words each
    service_titles = [
        " ".join(t.split()[:5]) for t in service_titles[:3]
    ]

    data["name"] = clean_business_value(data.get("name", ""), "Business Studio")
    
    # Enforce hero_title (tagline) max 8 words
    tagline = clean_business_value(data.get("tagline", ""), f"Premium tailored services for {data['name']}")
    tagline_words = tagline.split()
    if len(tagline_words) > 8:
        tagline = " ".join(tagline_words[:8])
    data["tagline"] = tagline

    # Enforce about (description) max 2 sentences / 2 lines
    description = clean_business_value(
        data.get("description", ""),
        f"{data['name']} delivers exceptional quality and reliable solutions built specifically to serve your primary needs."
    )
    # Split by sentence end markers
    sentences = [s.strip() for s in re.split(r'(?<=[.!?]) +', description) if s.strip()]
    description = " ".join(sentences[:2])
    desc_words = description.split()
    if len(desc_words) > 25:
        description = " ".join(desc_words[:25])
        if not description.endswith('.'):
            description += "."
    data["description"] = description

    data["services"] = service_titles
    # Store full service objects for API response
    data["services_full"] = [
        {"title": t, "description": d}
        for t, d in zip(service_titles, service_descriptions)
    ]

    # CONTACT — ensure required fields have sensible defaults
    contact = data.get("contact") or {}
    contact["phone"] = contact.get("phone") or "+91 98765 43210"
    contact["email"] = contact.get("email") or f"hello@{re.sub(r'[^a-z0-9]+', '', data['name'].lower()) or 'business'}.com"
    contact["address"] = contact.get("address") or f"{data['name']}, India"
    contact["hours"] = contact.get("hours") or "Mon-Sat, 9AM-6PM"
    contact["whatsapp"] = contact.get("whatsapp") or contact["phone"]
    contact["map_query"] = contact.get("map_query") or contact["address"]

    # User overrides from form input
    if user_input.get("email"):
        contact["email"] = user_input["email"]
    if user_input.get("instagram"):
        contact["instagram"] = user_input["instagram"]
    if user_input.get("twitter"):
        contact["twitter"] = user_input["twitter"]
    if user_input.get("youtube"):
        contact["youtube"] = user_input["youtube"]
    data["contact"] = contact

    # -----------------------------
    # IMAGE GENERATION
    # -----------------------------
    # Check if LLM provided direct image URLs (Unsplash)
    llm_images = data.get("images") or {}
    if not isinstance(llm_images, dict):
        llm_images = {}

    # If LLM gave us usable image URLs, inject them into user_input
    # so resolve_images can prefer them over Picsum auto-generation.
    # Sanitize first — reject any value that isn't a real HTTP URL.
    sanitized_llm = _sanitize_llm_images(llm_images)
    if sanitized_llm.get("hero"):  # at least the hero must be a valid URL
        user_input = dict(user_input)  # copy to avoid mutation
        existing_images = user_input.get("images") if isinstance(user_input.get("images"), list) else []
        if not existing_images:
            # Only inject if user didn't upload their own images
            user_input["_llm_images"] = sanitized_llm
            print(f"[GENERATE-AI] Using LLM image URLs: hero={sanitized_llm['hero']}")
    else:
        print("[GENERATE-AI] LLM images rejected or missing — using Picsum auto-images")

    image_keywords = build_image_keywords(data, idea)
    images = resolve_images(user_input, data["name"], image_keywords, idea)

    data["image_keywords"] = image_keywords
    data["images"] = images
    # Expose image URLs at top-level so frontend & API consumers can find them easily
    data["hero_image"]     = images.get("hero_image", "")
    data["about_image"]    = images.get("about_image", "")
    data["services_image"] = images.get("services_image", "")

    print(f"[GENERATE-AI] Final data.hero_image={data.get('hero_image')}")
    print(f"[GENERATE-AI] Final data.about_image={data.get('about_image')}")
    print(f"[GENERATE-AI] Final data.services_image={data.get('services_image')}")

    business_data = BusinessInput(
        name=data.get("name", ""),
        tagline=data.get("tagline", ""),
        description=data.get("description", ""),
        services=data["services"],
        contact=Contact(**data.get("contact", {}))
    )

    html = render_template(business_data, template, template_path, images)

    return {"html": html, "data": data, "template": template, "title": business_data.name}

# -----------------------------
# AI ASSISTANT — EDIT WITH AI
# -----------------------------
@app.post("/edit-with-ai")
def edit_with_ai(
    data: dict,
    user=Depends(get_optional_user),
):
    """Parse a plain-English editing instruction and return a structured action.

    Supported actions returned in JSON:
      { "action": "change_color",      "target": "<section>", "value": "<css-color>" }
      { "action": "change_background", "target": "<section>", "value": "<css-color>" }
      { "action": "increase_font",     "target": "<section>" }
      { "action": "decrease_font",     "target": "<section>" }
      { "action": "align_text",        "target": "<section>", "value": "left|center|right" }
      { "action": "improve_text",      "target": "<section>" }
      { "action": "none",              "message": "<hint>" }
    """
    command = (data.get("command") or data.get("instruction") or "").strip()
    context = (data.get("context") or data.get("currentData") or "").strip()

    print(f"[EDIT-WITH-AI] command={repr(command[:120])} caller={'auth:' + user['email'] if user else 'anon'}")

    if not command:
        return {"action": "none", "message": "Please enter an instruction."}

    # Fast local rules — avoid LLM call for common patterns
    cmd_lc = command.lower()
    COLOR_NAMES = {
        "red": "#ef4444", "blue": "#2563eb", "green": "#16a34a",
        "purple": "#7c3aed", "orange": "#ea580c", "yellow": "#eab308",
        "pink": "#ec4899", "black": "#111827", "white": "#ffffff",
        "dark": "#1e293b", "light": "#f8fafc", "gray": "#6b7280",
        "gold": "#b7791f", "teal": "#0d9488", "indigo": "#4338ca",
    }
    SECTION_WORDS = {
        "heading": "headings", "headings": "headings", "title": "headings",
        "about": "about", "services": "services", "service": "services",
        "contact": "contact", "text": "text", "all": "all",
        "button": "buttons", "buttons": "buttons",
    }

    def _detect_target(text: str) -> str:
        for word, section in SECTION_WORDS.items():
            if word in text:
                return section
        return "all"

    def _detect_color(text: str) -> str:
        for name, hex_val in COLOR_NAMES.items():
            if name in text:
                return hex_val
        import re
        m = re.search(r"#[0-9a-fA-F]{3,6}", text)
        if m:
            return m.group(0)
        return "#2563eb"

    # Increase / decrease font
    if any(w in cmd_lc for w in ["bigger", "larger", "increase font", "font bigger", "make text big"]):
        return {"action": "increase_font", "target": _detect_target(cmd_lc)}
    if any(w in cmd_lc for w in ["smaller", "decrease font", "font smaller", "reduce font"]):
        return {"action": "decrease_font", "target": _detect_target(cmd_lc)}

    # Alignment
    if "center" in cmd_lc and any(w in cmd_lc for w in ["align", "centre", "center all", "center text"]):
        return {"action": "align_text", "target": _detect_target(cmd_lc), "value": "center"}
    if "left" in cmd_lc and "align" in cmd_lc:
        return {"action": "align_text", "target": _detect_target(cmd_lc), "value": "left"}
    if "right" in cmd_lc and "align" in cmd_lc:
        return {"action": "align_text", "target": _detect_target(cmd_lc), "value": "right"}

    # Color — text color
    if any(w in cmd_lc for w in ["color", "colour", "make it", "turn"]) and \
       not any(w in cmd_lc for w in ["background", "bg ", "section color", "section colour"]):
        detected = _detect_color(cmd_lc)
        return {"action": "change_color", "target": _detect_target(cmd_lc), "value": detected}

    # Background
    if any(w in cmd_lc for w in ["background", "bg ", "section color", "backdrop"]):
        detected = _detect_color(cmd_lc)
        return {"action": "change_background", "target": _detect_target(cmd_lc), "value": detected}

    # Colorful / vibrant
    if any(w in cmd_lc for w in ["colorful", "colourful", "vibrant", "bright"]):
        return {"action": "change_color", "target": "all", "value": "#7c3aed"}

    # Improve / rewrite text
    if any(w in cmd_lc for w in ["improve", "rewrite", "better", "enhance", "upgrade", "fix text", "update text"]):
        return {"action": "improve_text", "target": _detect_target(cmd_lc)}

    # Fall through to LLM for anything ambiguous
    if not GROQ_API_KEY:
        return {
            "action": "none",
            "message": "Try: 'Make headings blue', 'Center all text', 'Improve about section', 'Make it colorful'",
        }

    prompt = (
        "You are an AI that interprets plain-English website editing instructions and returns ONLY a JSON action object.\n"
        "Valid actions: change_color, change_background, increase_font, decrease_font, align_text, improve_text, none.\n"
        "Valid targets: headings, about, services, contact, text, buttons, all.\n\n"
        "Return JSON only. No markdown. No explanation.\n\n"
        "Examples:\n"
        '  instruction: "Make all headings blue" → {"action":"change_color","target":"headings","value":"#2563eb"}\n'
        '  instruction: "Center everything" → {"action":"align_text","target":"all","value":"center"}\n'
        '  instruction: "Improve about section" → {"action":"improve_text","target":"about"}\n'
        '  instruction: "Make background dark" → {"action":"change_background","target":"all","value":"#1e293b"}\n'
        '  instruction: "Hello" → {"action":"none","message":"I can edit colors, fonts, alignment, or text. Try: make headings blue"}\n\n'
        f'Website context: {context[:300]}\n'
        f'Instruction: "{command}"\n\n'
        "Return ONLY the JSON object:"
    )

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [
                    {"role": "system", "content": "Return JSON only. No markdown."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 120,
            },
            timeout=15,
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"]
        parsed = clean_llm_output(raw)
        if parsed and isinstance(parsed, dict) and parsed.get("action"):
            print(f"[EDIT-WITH-AI] LLM returned: {parsed}")
            return parsed
        print(f"[EDIT-WITH-AI] LLM unparseable response: {repr(raw[:200])}")
    except Exception as exc:
        print(f"[EDIT-WITH-AI] LLM call failed: {exc}")

    return {
        "action": "none",
        "message": "Try: 'Make headings blue', 'Center all text', 'Improve about section', 'Increase font size'",
    }


# -----------------------------
# AI ASSISTANT — REWRITE TEXT
# -----------------------------
@app.post("/rewrite-text")
def rewrite_text(
    data: dict,
    user=Depends(get_optional_user),
):
    """Rewrite the text of a specific website section using the LLM.

    Request body: { "target": "about|services|contact|...", "current": "<existing text>", "context": "<website context>" }
    Response:     { "text": "<improved text>" }
    """
    target  = (data.get("target") or "about").strip()
    current = (data.get("current") or "").strip()
    context = (data.get("context") or "").strip()

    print(f"[REWRITE-TEXT] target={target} caller={'auth:' + user['email'] if user else 'anon'}")

    if not current:
        raise HTTPException(status_code=400, detail="'current' text is required.")

    # Fallback: if no LLM key, return a cleaned version of the existing text
    if not GROQ_API_KEY:
        improved = " ".join(current.split())  # just tidy whitespace
        return {"text": improved}

    tone_map = {
        "about":    "warm, trust-building, professional",
        "services": "benefit-focused, concise, action-oriented",
        "contact":  "friendly, clear, inviting",
        "headings": "punchy, memorable, max 8 words",
    }
    tone = tone_map.get(target, "professional and engaging")

    prompt = (
        f"You are a professional copywriter rewriting the '{target}' section of a business website.\n"
        f"Tone: {tone}.\n"
        f"Website context: {context[:300]}\n\n"
        f"Original text:\n{current[:500]}\n\n"
        f"Return ONLY the improved text. No JSON. No explanation. Max 60 words. Keep it natural."
    )

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.1-8b-instant",
                "messages": [
                    {"role": "system", "content": "Return improved copywriting text only. No JSON, no markdown."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.6,
                "max_tokens": 150,
            },
            timeout=20,
        )
        response.raise_for_status()
        improved = response.json()["choices"][0]["message"]["content"].strip()
        # Strip any accidental markdown
        improved = re.sub(r"^```[a-z]*\s*", "", improved)
        improved = re.sub(r"\s*```$", "", improved).strip()
        print(f"[REWRITE-TEXT] success, result={repr(improved[:80])}")
        return {"text": improved}
    except Exception as exc:
        print(f"[REWRITE-TEXT] LLM call failed: {exc}")
        raise HTTPException(status_code=502, detail=f"Rewrite failed: {exc}")


# -----------------------------
# PROJECTS
# -----------------------------
@app.get("/my-projects")
def get_projects(
    user=Depends(get_current_user)
):
    projects = projects_collection.find({"user_id": user["id"]}).sort("created_at", -1)

    result = []
    for p in projects:
        result.append(
            {
                "id": str(p["_id"]),
                "name": p.get("name"),
                "title": p.get("name"),
                "template": p.get("template"),
                "html": p.get("html"),
                "data": p.get("data") or {},
                "data_json": json.dumps(p.get("data") or {}),
                "created_at": p.get("created_at"),
                "is_published": p.get("is_published", False),
            }
        )
    return result
# -----------------------------
# SAVE PROJECT
# -----------------------------
@app.post("/save-project")
def save_project(
    data: dict,
    user=Depends(get_current_user)
):
    project_doc = {
        "user_id": user["id"],
        "name": data.get("name", "Untitled Project"),
        "template": data.get("template", "generic"),
        "data": data.get("data") or extract_project_data_from_html(data.get("html", "")),
        "html": data.get("html", ""),
        "created_at": datetime.utcnow().timestamp(),
        "is_published": bool(data.get("is_published", False)),
    }

    inserted = projects_collection.insert_one(project_doc)
    return {"message": "Project saved", "project_id": str(inserted.inserted_id)}

# -----------------------------
# UPDATE PROJECT
# -----------------------------
@app.put("/update-project")
def update_project(
    data: dict,
    user=Depends(get_current_user)
):
    try:
        project_oid = ObjectId(str(data["project_id"]))
    except:
        raise HTTPException(400, "Invalid project id")

    project = projects_collection.find_one({"_id": project_oid, "user_id": user["id"]})

    if not project:
        raise HTTPException(403, "Unauthorized")

    update_fields = {
        "html": data["html"],
        "updated_at": datetime.utcnow().timestamp(),
    }

    if data.get("name"):
        update_fields["name"] = data["name"]

    if data.get("template"):
        update_fields["template"] = data["template"]

    if "is_published" in data:
        update_fields["is_published"] = bool(data["is_published"])

    if "data" in data:
        existing = project.get("data") or {}
        if not isinstance(existing, dict):
            existing = {}

        incoming = data["data"] if isinstance(data["data"], dict) else {}
        existing.update(incoming)
        update_fields["data"] = existing

    projects_collection.update_one({"_id": project_oid}, {"$set": update_fields})

    return {"message": "Updated successfully"}
#--------------------------------------
#DELETE PROJECT
#----------------------------------
@app.delete("/delete-project/{project_id}")
def delete_project(
    project_id: str,
    user=Depends(get_current_user)
):
    try:
        project_oid = ObjectId(project_id)
    except:
        raise HTTPException(400, "Invalid project id")

    project = projects_collection.find_one({"_id": project_oid, "user_id": user["id"]})

    if not project:
        raise HTTPException(404, "Project not found")

    projects_collection.delete_one({"_id": project_oid})

    return {"message": "Project deleted"}

# -----------------------------
# PUBLISHED WEBSITE
# -----------------------------
class PublishRequest(BaseModel):
    html: str
    project_id: Optional[str] = None

@app.post("/publish")
def publish_project_post(req: PublishRequest, user=Depends(get_current_user)):
    published_html = apply_published_mode(req.html)
    if req.project_id:
        try:
            project_oid = ObjectId(req.project_id)
        except Exception:
            raise HTTPException(400, "Invalid project id")

        project = projects_collection.find_one({"_id": project_oid, "user_id": user["id"]})
        if not project:
            raise HTTPException(404, "Project not found")

        projects_collection.update_one(
            {"_id": project_oid},
            {"$set": {"html": req.html, "is_published": True, "updated_at": datetime.utcnow().timestamp()}},
        )
    return HTMLResponse(content=published_html)

@app.get("/published/{project_id}", response_class=HTMLResponse)
def published_project(project_id: str):
    try:
        project_oid = ObjectId(project_id)
    except:
        raise HTTPException(400, "Invalid project id")

    project = projects_collection.find_one({"_id": project_oid})

    if not project:
        raise HTTPException(404, "Project not found")

    return HTMLResponse(content=apply_published_mode(project.get("html") or ""))

# -----------------------------
# ROOT
# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Backend running 🚀"}
