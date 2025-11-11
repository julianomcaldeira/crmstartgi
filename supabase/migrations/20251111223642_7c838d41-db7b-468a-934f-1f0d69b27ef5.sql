-- Ensure juliano@startgi.com.br is always admin
DO $$
DECLARE
  juliano_user_id UUID;
BEGIN
  -- Get juliano's user ID from profiles
  SELECT id INTO juliano_user_id 
  FROM profiles 
  WHERE email = 'juliano@startgi.com.br' 
  LIMIT 1;

  -- If juliano exists, ensure he has admin role
  IF juliano_user_id IS NOT NULL THEN
    -- Remove any existing role for juliano
    DELETE FROM user_roles WHERE user_id = juliano_user_id;
    
    -- Add admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (juliano_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;