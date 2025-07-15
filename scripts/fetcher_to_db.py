import imaplib
import email
from email.header import decode_header
import os
import re
import psycopg2
from dotenv import load_dotenv
from datetime import datetime
import html
import time

# Load environment variables
load_dotenv()

IMAP_SERVER = os.getenv("IMAP_SERVER")
IMAP_PORT = int(os.getenv("IMAP_PORT"))
EMAIL_USER = os.getenv("EMAIL")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
DATABASE_URL = os.getenv("DATABASE_URL")

def get_last_processed_uid():
    conn = psycopg2.connect(dsn=DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reservation_emails (
            id BIGINT PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            email VARCHAR(255) NOT NULL,
            reservation_date DATE NOT NULL,
            reservation_time TIME NOT NULL,
            guests INTEGER NOT NULL,
            special_requests TEXT,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected'))
        );
    """)
    cursor.execute("SELECT MAX(id) FROM reservation_emails;")
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result[0] if result[0] else 0

def extract_cleaned(field, body, strip_html=False, fallback=''):
    match = re.search(f"{field}\\*?:\\s*(.*)", body)
    raw = match.group(1).strip() if match else fallback
    return strip_html_tags(raw) if strip_html else raw

def insert_to_db(uid, data):
    conn = psycopg2.connect(dsn=DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO reservation_emails (
            id, first_name, last_name, phone, email,
            reservation_date, reservation_time, guests,
            special_requests, received_at, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending');
    """, (uid, *data))
    conn.commit()
    cursor.close()
    conn.close()

def strip_html_tags(text):
    clean = re.sub(r'<[^>]+>', '', text)
    return html.unescape(clean).strip()

def format_name(name):
    return name.strip().capitalize()

def format_phone(phone):
    phone = phone.strip()
    return phone if phone.startswith("+") else "+49" + re.sub(r"^0", "", phone)

def parse_body(body):
    first_name = format_name(extract_cleaned("Vorname", body))
    last_name = format_name(extract_cleaned("Nachname", body))
    phone = format_phone(extract_cleaned("Telefon", body))
    email_addr = extract_cleaned("E-Mail-Adresse", body)

    # Здесь очищаем от HTML
    date_str = extract_cleaned("Datum wählen", body, strip_html=True)
    time_str = extract_cleaned("Choose a time", body, strip_html=True)
    guests_raw = extract_cleaned("Anzahl Personen", body, strip_html=True)
    special_requests = extract_cleaned("Anmerkungen", body, strip_html=True)

    try:
        guests = int(re.sub(r"\D", "", guests_raw))
    except ValueError:
        guests = 1

    try:
        reservation_date = datetime.strptime(date_str, "%d.%m.%Y").date()
    except ValueError:
        raise ValueError(f"Invalid or missing reservation date: '{date_str}'")

    try:
        reservation_time = datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        raise ValueError(f"Invalid or missing reservation time: '{time_str}'")

    return (first_name, last_name, phone, email_addr, reservation_date, reservation_time, guests, special_requests)

def fetch_emails():
    mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
    mail.login(EMAIL_USER, EMAIL_PASSWORD)
    mail.select("inbox")

    result, data = mail.uid("search", None, '(SUBJECT "[aljonuschka] Reservierungsanfragen - neue Einreichung")')
    uids = list(map(int, data[0].split()))[::-1]  # convert to int, newest first

    last_processed_uid = get_last_processed_uid()

    for uid in uids:
        if uid <= last_processed_uid:
            print(f"🟡 Stopped at UID {uid}, already processed.")
            break

        result, msg_data = mail.uid("fetch", str(uid), "(RFC822)")
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)

        date_tuple = email.utils.parsedate_tz(msg["Date"])
        received_at = datetime.fromtimestamp(email.utils.mktime_tz(date_tuple)) if date_tuple else datetime.now()

        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    body = part.get_payload(decode=True).decode(part.get_content_charset("utf-8"))
                    break
                elif content_type == "text/html":
                    html_body = part.get_payload(decode=True).decode(part.get_content_charset("utf-8"))
                    body = strip_html_tags(html_body)
        else:
            content_type = msg.get_content_type()
            raw = msg.get_payload(decode=True).decode(msg.get_content_charset("utf-8"))
            body = strip_html_tags(raw) if content_type == "text/html" else raw

        try:
            parsed_data = parse_body(body)
            insert_to_db(uid, (*parsed_data, received_at))
            print(f"✅ Inserted UID {uid}: {parsed_data[0]} {parsed_data[1]}")
        except Exception as e:
            print(f"❌ Error with UID {uid}: {e}")

    mail.logout()

if __name__ == "__main__":
    print("📡 Aljonuschka fetcher daemon started.")
    while True:
        try:
            fetch_emails()
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
        print("⏳ Waiting 15 minutes...")
        time.sleep(15 * 60)