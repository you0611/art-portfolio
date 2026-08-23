ALTER TABLE orders ADD COLUMN customer_contact TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX orders_idempotency_key_idx
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
