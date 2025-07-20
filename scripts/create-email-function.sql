CREATE OR REPLACE FUNCTION insert_reservation_email(
    p_id BIGINT,
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_phone VARCHAR,
    p_email VARCHAR,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_guests INTEGER,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO reservation_emails (
        id, first_name, last_name, phone, email,
        reservation_date, reservation_time, guests,
        special_requests
    ) VALUES (
        p_id, p_first_name, p_last_name, p_phone, p_email,
        p_reservation_date, p_reservation_time, p_guests,
        p_special_requests
    );
END;
$$ LANGUAGE plpgsql;