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
('staff', '$2a$12$M510dL2KJLiYU21Fgw0TK.CQ9DnsJDdEdHUnCQzQEEjJWIKIpwVRK'),
('admin', '$2a$12$s0s8rnEk5TWP81aq.7q3oukasGr73dp8lqark8Pl2ZBS/WiSmL6pa');

-- Note: In production, you should generate these hashes using bcrypt
-- Example in Node.js: await bcrypt.hash('staff123', 12)
