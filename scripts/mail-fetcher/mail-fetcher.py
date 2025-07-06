#!/usr/bin/env python3
import imaplib
import email
from email.header import decode_header
import re
import datetime
import json
from typing import List, Dict, Any, Optional, Tuple

# Конфигурация IMAP-сервера
imapserver = "imap.strato.de"
port = 993
mail = "reservierung@aljonuschka.de"
password = "password"  # В продакшене рекомендуется использовать переменные окружения
subject_keywords = ["Reservierungsanfragen"]
content_keywords = ["Vorname", "Nachname", "Telefon", "E-Mail-Adresse", "Datum wählen", "Choose a time", "Anzahl Personen", "Anmerkungen"]


class MailFetcher:
    """
    Класс для подключения к IMAP-серверу и извлечения писем с резервациями
    """
    def __init__(
        self, 
        server: str, 
        port: int, 
        email: str, 
        password: str,
        subject_keywords: List[str],
        content_keywords: List[str]
    ):
        self.server = server
        self.port = port
        self.email = email
        self.password = password
        self.subject_keywords = subject_keywords
        self.content_keywords = content_keywords
        self.imap = None
    
    def connect(self) -> bool:
        """
        Подключение к IMAP серверу
        
        Returns:
            bool: Успешность подключения
        """
        try:
            self.imap = imaplib.IMAP4_SSL(self.server, self.port)
            self.imap.login(self.email, self.password)
            return True
        except Exception as e:
            print(f"Ошибка подключения к IMAP серверу: {e}")
            return False
    
    def disconnect(self) -> None:
        """
        Отключение от IMAP сервера
        """
        if self.imap:
            try:
                self.imap.logout()
            except Exception as e:
                print(f"Ошибка при отключении от сервера: {e}")
    
    def _decode_subject(self, subject: Any) -> str:
        """
        Декодирование темы письма
        
        Args:
            subject: Закодированная тема письма
            
        Returns:
            str: Декодированная тема письма
        """
        if subject is None:
            return ""
            
        decoded = decode_header(subject)
        subject_parts = []
        
        for part, encoding in decoded:
            if isinstance(part, bytes):
                if encoding:
                    try:
                        part = part.decode(encoding)
                    except Exception:
                        try:
                            part = part.decode('utf-8')
                        except Exception:
                            part = part.decode('latin-1')
                else:
                    try:
                        part = part.decode('utf-8')
                    except Exception:
                        part = part.decode('latin-1')
            subject_parts.append(str(part))
            
        return "".join(subject_parts)
    
    def _get_body(self, msg: email.message.Message) -> str:
        """
        Извлечение текста из письма
        
        Args:
            msg: Объект письма
            
        Returns:
            str: Текст письма
        """
        body = ""
        
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))
                
                if content_type == "text/plain" and "attachment" not in content_disposition:
                    try:
                        body = part.get_payload(decode=True).decode('utf-8')
                    except UnicodeDecodeError:
                        try:
                            body = part.get_payload(decode=True).decode('latin-1')
                        except Exception as e:
                            print(f"Ошибка при декодировании части письма: {e}")
                    break
        else:
            try:
                body = msg.get_payload(decode=True).decode('utf-8')
            except UnicodeDecodeError:
                try:
                    body = msg.get_payload(decode=True).decode('latin-1')
                except Exception as e:
                    print(f"Ошибка при декодировании тела письма: {e}")
        
        return body
    
    def _extract_reservation_data(self, body: str) -> Dict[str, Any]:
        """
        Извлечение данных о резервации из текста письма
        
        Args:
            body: Текст письма
            
        Returns:
            Dict[str, Any]: Словарь с данными о резервации
        """
        data = {}
        
        # Проверяем наличие всех ключевых слов в теле письма
        if not all(keyword.lower() in body.lower() for keyword in self.content_keywords):
            return data
        
        # Извлекаем имя
        vorname_match = re.search(r'Vorname:\s*([^\r\n]+)', body)
        if vorname_match:
            data["vorname"] = vorname_match.group(1).strip()
        
        # Извлекаем фамилию
        nachname_match = re.search(r'Nachname:\s*([^\r\n]+)', body)
        if nachname_match:
            data["nachname"] = nachname_match.group(1).strip()
        
        # Извлекаем телефон
        telefon_match = re.search(r'Telefon:\s*([^\r\n]+)', body)
        if telefon_match:
            data["telefon"] = telefon_match.group(1).strip()
        
        # Извлекаем email
        email_match = re.search(r'E-Mail-Adresse:\s*([^\r\n]+)', body)
        if email_match:
            data["email"] = email_match.group(1).strip()
        
        # Извлекаем дату
        datum_match = re.search(r'Datum wählen:\s*([^\r\n]+)', body)
        if datum_match:
            data["datum"] = datum_match.group(1).strip()
        
        # Извлекаем время
        time_match = re.search(r'Choose a time:\s*([^\r\n]+)', body)
        if time_match:
            data["time"] = time_match.group(1).strip()
        
        # Извлекаем количество персон
        personen_match = re.search(r'Anzahl Personen:\s*([^\r\n]+)', body)
        if personen_match:
            personen_str = personen_match.group(1).strip()
            try:
                data["personen"] = int(personen_str)
            except ValueError:
                data["personen"] = personen_str
        
        # Извлекаем примечания
        anmerkungen_match = re.search(r'Anmerkungen:\s*([^\r\n]+)', body)
        if anmerkungen_match:
            data["anmerkungen"] = anmerkungen_match.group(1).strip()
        
        return data
    
    def fetch_reservations(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        Получение писем с резервациями за указанное количество дней
        
        Args:
            days: Количество дней для поиска писем (по умолчанию 7)
            
        Returns:
            List[Dict[str, Any]]: Список с данными о резервациях
        """
        if not self.connect():
            return []
        
        reservations = []
        
        try:
            # Выбираем папку INBOX
            self.imap.select("INBOX")
            
            # Формируем дату для поиска
            date = (datetime.datetime.now() - datetime.timedelta(days=days)).strftime("%d-%b-%Y")
            
            # Ищем письма по дате
            status, messages = self.imap.search(None, f'(SINCE {date})')
            
            if status != 'OK':
                print(f"Ошибка при поиске писем: {status}")
                return []
            
            # Получаем ID писем
            message_ids = messages[0].split()
            
            for msg_id in message_ids:
                # Получаем письмо по ID
                status, msg_data = self.imap.fetch(msg_id, "(RFC822)")
                
                if status != 'OK':
                    print(f"Ошибка при получении письма {msg_id}: {status}")
                    continue
                
                # Парсим письмо
                msg = email.message_from_bytes(msg_data[0][1])
                
                # Получаем тему письма
                subject = self._decode_subject(msg.get("Subject"))
                
                # Проверяем, содержит ли тема ключевые слова
                if not any(keyword.lower() in subject.lower() for keyword in self.subject_keywords):
                    continue
                
                # Получаем текст письма
                body = self._get_body(msg)
                
                # Извлекаем данные о резервации
                reservation_data = self._extract_reservation_data(body)
                
                if reservation_data:
                    # Добавляем дополнительную информацию о письме
                    reservation_data["subject"] = subject
                    reservation_data["date_received"] = msg.get("Date")
                    reservation_data["from"] = msg.get("From")
                    reservation_data["message_id"] = msg.get("Message-ID")
                    
                    reservations.append(reservation_data)
            
            return reservations
            
        except Exception as e:
            print(f"Ошибка при обработке писем: {e}")
            return []
        
        finally:
            self.disconnect()


def main():
    """
    Основная функция для запуска сервиса
    """
    fetcher = MailFetcher(
        server=imapserver,
        port=port,
        email=mail,
        password=password,
        subject_keywords=subject_keywords,
        content_keywords=content_keywords
    )
    
    # Получаем резервации за последние 30 дней
    reservations = fetcher.fetch_reservations(days=30)
    
    if not reservations:
        print("Резервации не найдены")
    else:
        print(f"Найдено {len(reservations)} резерваций:")
        print(json.dumps(reservations, indent=4, ensure_ascii=False))


if __name__ == "__main__":
    main()