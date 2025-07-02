-- Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guests INTEGER NOT NULL,
  special_requests TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data for July 2, 2025
INSERT INTO reservations (first_name, last_name, phone, email, reservation_date, reservation_time, guests, special_requests) VALUES
('John', 'Smith', '+1-555-0123', 'john.smith@email.com', '2025-07-02', '12:00:00', 2, 'Window table preferred'),
('Maria', 'Garcia', '+1-555-0124', 'maria.garcia@email.com', '2025-07-02', '12:30:00', 4, 'Birthday celebration'),
('David', 'Johnson', '+1-555-0125', 'david.johnson@email.com', '2025-07-02', '13:15:00', 3, 'Vegetarian options needed'),
('Sarah', 'Williams', '+1-555-0126', 'sarah.williams@email.com', '2025-07-02', '14:00:00', 2, NULL),
('Michael', 'Brown', '+1-555-0127', 'michael.brown@email.com', '2025-07-02', '18:30:00', 6, 'Anniversary dinner'),
('Emma', 'Davis', '+1-555-0128', 'emma.davis@email.com', '2025-07-02', '19:00:00', 2, 'Allergic to nuts'),
('James', 'Miller', '+1-555-0129', 'james.miller@email.com', '2025-07-02', '19:45:00', 4, NULL),
('Lisa', 'Wilson', '+1-555-0130', 'lisa.wilson@email.com', '2025-07-02', '20:15:00', 3, 'Late arrival possible'),
('Robert', 'Moore', '+1-555-0131', 'robert.moore@email.com', '2025-07-02', '21:00:00', 2, 'Quiet table requested');
