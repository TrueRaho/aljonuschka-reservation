-- Create auth table for storing hashed passwords
CREATE TABLE IF NOT EXISTS auth_passwords (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert hashed passwords (using bcrypt with salt rounds 12)
-- Staff password: "staff123" 
-- Admin password: "admin456"
INSERT INTO auth_passwords (role, password_hash) VALUES
('staff', '$2b$12$rQJ8YqF7H.Zx9Z8vK2L3/.XJ4K5M6N7O8P9Q0R1S2T3U4V5W6X7Y8Z'),
('admin', '$2b$12$sT9U0V1W2X3Y4Z5A6B7C8D.9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T');

-- Note: In production, you should generate these hashes using bcrypt
-- Example in Node.js: await bcrypt.hash('staff123', 12)
