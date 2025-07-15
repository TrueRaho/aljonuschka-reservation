import imaplib
from dotenv import load_dotenv
import os

load_dotenv()

try:
    # Подключение к серверу
    mail = imaplib.IMAP4_SSL(os.getenv('IMAP_SERVER'), os.getenv('IMAP_PORT'))
    
    # Попытка входа
    mail.login(os.getenv('EMAIL'), os.getenv('EMAIL_PASSWORD'))
    
    print("Успешное подключение к IMAP серверу.")
    
    # Закрытие соединения
    mail.logout()

except imaplib.IMAP4.error as e:
    print("Ошибка при подключении:", str(e))

except Exception as e:
    print("Непредвиденная ошибка:", str(e))