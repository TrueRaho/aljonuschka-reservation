-- Create table for pending reservation emails
CREATE TABLE IF NOT EXISTS reservation_emails (
  id SERIAL PRIMARY KEY,
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

-- Insert sample email reservation requests
INSERT INTO reservation_emails (first_name, last_name, phone, email, reservation_date, reservation_time, guests, special_requests, received_at, status) VALUES
('Anna', 'Petrov', '+1-555-0123', 'anna.petrov@email.com', '2025-07-03', '19:00:00', 2, 'Window table if possible', '2025-07-01 10:30:00', 'pending'),
('Mark', 'Johnson', '+1-555-0124', 'mark.johnson@email.com', '2025-07-04', '20:00:00', 4, NULL, '2025-07-01 14:15:00', 'pending'),
('Sofia', 'Martinez', '+1-555-0125', 'sofia.martinez@email.com', '2025-07-05', '19:30:00', 6, 'Birthday celebration - cake allowed?', '2025-07-02 09:45:00', 'pending'),
('Peter', 'Wong', '+1-555-0126', 'peter.wong@email.com', '2025-07-02', '18:00:00', 3, 'Vegetarian menu options needed', '2025-06-30 16:20:00', 'confirmed'),
('Lisa', 'Brown', '+1-555-0127', 'lisa.brown@email.com', '2025-07-06', '20:30:00', 2, NULL, '2025-07-02 11:10:00', 'rejected');
