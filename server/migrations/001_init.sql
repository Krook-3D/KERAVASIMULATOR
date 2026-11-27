-- Kerava Simulator: initial schema. See docs/MULTIPLAYER.md section 18.
-- Money is integer cents. Never edit an applied migration; add a new one.

CREATE TABLE accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL,
  password_hash      text NOT NULL,
  status             text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'muted', 'trade_banned', 'banned')),
  status_until       timestamptz,
  adult_confirmed_at timestamptz NOT NULL,
  terms_version      int NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz
);
CREATE UNIQUE INDEX accounts_email_uq ON accounts (lower(email));

CREATE TABLE sessions (
  token_hash  bytea PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  ip          inet,
  user_agent  text
);
CREATE INDEX sessions_account_idx ON sessions (account_id);

CREATE TABLE login_attempts (
  id          bigserial PRIMARY KEY,
  email       text NOT NULL,
  ip          inet,
  success     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts (lower(email), created_at);
CREATE INDEX login_attempts_ip_idx ON login_attempts (ip, created_at);

CREATE TABLE characters (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  name           text NOT NULL,
  color          text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  money          bigint NOT NULL DEFAULT 0 CHECK (money >= 0 AND money <= 2147483647),
  xp             bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  health         int NOT NULL DEFAULT 100,
  energy         int NOT NULL DEFAULT 100,
  pos_x          double precision NOT NULL DEFAULT 0,
  pos_z          double precision NOT NULL DEFAULT 0,
  heat           int NOT NULL DEFAULT 0 CHECK (heat BETWEEN 0 AND 100),
  heat_updated_at timestamptz NOT NULL DEFAULT now(),
  jailed_until   timestamptz,
  play_seconds   bigint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX characters_name_uq ON characters (lower(name));
CREATE INDEX characters_account_idx ON characters (account_id);

CREATE TABLE character_skills (
  character_id uuid NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  skill_id     text NOT NULL,
  xp           bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  PRIMARY KEY (character_id, skill_id)
);

CREATE TABLE character_quests (
  character_id    uuid NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  quest_id        text NOT NULL,
  status          text NOT NULL CHECK (status IN ('active', 'completed')),
  objective_index int NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, quest_id)
);

-- Stackable holdings. location: 'pack' (carried) or 'home' (home storage).
CREATE TABLE inventory_items (
  character_id uuid NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  location     text NOT NULL CHECK (location IN ('pack', 'home')),
  item_id      text NOT NULL,
  quantity     bigint NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (character_id, location, item_id)
);

-- Unique items with their own identity and provenance (later: durability).
CREATE TABLE item_instances (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id            text NOT NULL,
  owner_character_id uuid REFERENCES characters (id) ON DELETE SET NULL,
  location           text NOT NULL CHECK (location IN ('pack', 'home', 'escrow', 'collect')),
  attrs              jsonb NOT NULL DEFAULT '{}',
  created_reason     text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_instances_owner_idx ON item_instances (owner_character_id);

-- Every change to money or items. sum(delta) per (character, kind, item) == balance.
CREATE TABLE ledger (
  id            bigserial PRIMARY KEY,
  character_id  uuid NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('money', 'item')),
  item_id       text,
  location      text,
  delta         bigint NOT NULL CHECK (delta <> 0),
  balance_after bigint NOT NULL,
  reason        text NOT NULL,
  ref_type      text,
  ref_id        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'money') = (item_id IS NULL))
);
CREATE INDEX ledger_character_idx ON ledger (character_id, created_at);
CREATE INDEX ledger_reason_idx ON ledger (reason, created_at);
CREATE INDEX ledger_ref_idx ON ledger (ref_type, ref_id);

CREATE TABLE trades (
  id           uuid PRIMARY KEY,
  a_id         uuid NOT NULL REFERENCES characters (id),
  b_id         uuid NOT NULL REFERENCES characters (id),
  a_offer      jsonb NOT NULL,
  b_offer      jsonb NOT NULL,
  status       text NOT NULL CHECK (status IN ('completed', 'failed')),
  created_at   timestamptz NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (a_id <> b_id)
);
CREATE INDEX trades_a_idx ON trades (a_id, completed_at);
CREATE INDEX trades_b_idx ON trades (b_id, completed_at);

-- Kerava-Pörssi
CREATE TABLE market_orders (
  id           bigserial PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES characters (id),
  item_id      text NOT NULL,
  side         text NOT NULL CHECK (side IN ('buy', 'sell')),
  price        bigint NOT NULL CHECK (price > 0),
  quantity     bigint NOT NULL CHECK (quantity > 0),
  remaining    bigint NOT NULL CHECK (remaining >= 0 AND remaining <= quantity),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled', 'expired')),
  idempotency_key text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX market_orders_book_idx ON market_orders (item_id, side, price, created_at) WHERE status = 'open';
CREATE INDEX market_orders_character_idx ON market_orders (character_id) WHERE status = 'open';
CREATE UNIQUE INDEX market_orders_idem_uq ON market_orders (character_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE market_trades (
  id            bigserial PRIMARY KEY,
  item_id       text NOT NULL,
  buy_order_id  bigint NOT NULL REFERENCES market_orders (id),
  sell_order_id bigint NOT NULL REFERENCES market_orders (id),
  price         bigint NOT NULL,
  quantity      bigint NOT NULL,
  tax           bigint NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_trades_item_idx ON market_trades (item_id, created_at);

-- Collect box: matched goods and refunds waiting to be picked up. item_id NULL = money.
CREATE TABLE market_collect (
  id           bigserial PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES characters (id),
  item_id      text,
  amount       bigint NOT NULL CHECK (amount > 0),
  order_id     bigint REFERENCES market_orders (id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_collect_character_idx ON market_collect (character_id);

CREATE TABLE market_guide_prices (
  item_id    text PRIMARY KEY,
  price      bigint NOT NULL CHECK (price > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE economy_config (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE economy_daily_stats (
  day     date PRIMARY KEY,
  metrics jsonb NOT NULL
);

CREATE TABLE admin_audit (
  id               bigserial PRIMARY KEY,
  admin_account_id uuid REFERENCES accounts (id),
  action           text NOT NULL,
  target           text,
  reason           text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
