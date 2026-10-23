-- Demo accounts (password: demo123). Safe to run more than once.
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Sara Khan', 'sara@eam.demo', '$2b$10$2HG3H3NaGPOTRlZNGzhqwOY09hkMY8JkLhr6VGj2f.aY5iTe7Bisy', 'consultant'),
  ('Omar Malik', 'omar@eam.demo', '$2b$10$bAoNIahbyGH1XjucazJRGeXEht4dZTf0DkErsk2APztlPAH/gEIYO', 'admin')
ON CONFLICT (email) DO NOTHING;
