-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── PROFILES (extends Supabase Auth users) ──────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  loyalty_tier TEXT NOT NULL DEFAULT 'member'
                CHECK (loyalty_tier IN ('member','royal','king','legend')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ── LOCATIONS ───────────────────────────────────────────────────────
CREATE TABLE locations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  city        TEXT,
  country     TEXT NOT NULL DEFAULT 'US',
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  phone       TEXT,
  hours       JSONB,
  features    TEXT[]   NOT NULL DEFAULT '{}',
  is_active   BOOLEAN  NOT NULL DEFAULT TRUE
);

-- ── MENU ITEMS ──────────────────────────────────────────────────────
CREATE TABLE menu_items (
  id           SERIAL PRIMARY KEY,
  tab          TEXT NOT NULL CHECK (tab IN ('burgers','chicken','sides','drinks','desserts')),
  name         TEXT NOT NULL,
  description  TEXT,
  price        DECIMAL(8,2) NOT NULL CHECK (price >= 0),
  calories     INTEGER,
  image_url    TEXT,
  tags         TEXT[]  NOT NULL DEFAULT '{}',
  points_value INTEGER NOT NULL DEFAULT 10,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── DEALS ───────────────────────────────────────────────────────────
CREATE TABLE deals (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  original_price   DECIMAL(8,2),
  deal_price       DECIMAL(8,2) NOT NULL,
  expires_at       TIMESTAMPTZ,
  is_app_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── ORDERS ──────────────────────────────────────────────────────────
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stripe_session_id TEXT UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','preparing','ready','delivered','cancelled')),
  total             DECIMAL(8,2) NOT NULL CHECK (total >= 0),
  points_awarded    INTEGER NOT NULL DEFAULT 0,
  location_id       INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  order_type        TEXT NOT NULL DEFAULT 'pickup'
                      CHECK (order_type IN ('pickup','delivery','dine-in')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ORDER ITEMS ─────────────────────────────────────────────────────
CREATE TABLE order_items (
  id           SERIAL PRIMARY KEY,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  price        DECIMAL(8,2) NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

-- ── LOYALTY TRANSACTIONS ────────────────────────────────────────────
CREATE TABLE loyalty_transactions (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  points      INTEGER NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Computed view: total points per user
CREATE VIEW loyalty_balances AS
SELECT user_id, SUM(points) AS balance
FROM loyalty_transactions
GROUP BY user_id;

-- Auto-update loyalty tier based on lifetime points
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE total_pts INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO total_pts
  FROM loyalty_transactions WHERE user_id = NEW.user_id;

  UPDATE profiles SET loyalty_tier =
    CASE
      WHEN total_pts >= 10000 THEN 'legend'
      WHEN total_pts >= 5000  THEN 'king'
      WHEN total_pts >= 1000  THEN 'royal'
      ELSE 'member'
    END
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_loyalty_change
  AFTER INSERT OR UPDATE ON loyalty_transactions
  FOR EACH ROW EXECUTE PROCEDURE update_loyalty_tier();

-- ── NEWSLETTER ──────────────────────────────────────────────────────
CREATE TABLE newsletter_subscribers (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own
CREATE POLICY "Own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Orders: users see only their own
CREATE POLICY "Own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Order items: visible if the parent order belongs to the user
CREATE POLICY "Own order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id AND user_id = auth.uid())
  );

-- Loyalty: users see their own transactions
CREATE POLICY "Own loyalty" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Public read for locations, menu_items, deals
CREATE POLICY "Public locations" ON locations FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public menu"      ON menu_items FOR SELECT USING (is_available = TRUE);
CREATE POLICY "Public deals"     ON deals      FOR SELECT USING (is_active = TRUE);
ALTER TABLE locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals      ENABLE ROW LEVEL SECURITY;
