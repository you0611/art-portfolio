ALTER TABLE orders ADD COLUMN follow_up_status TEXT NOT NULL DEFAULT 'unprocessed'
  CHECK (follow_up_status IN ('unprocessed', 'contacting', 'completed', 'cancelled'));
ALTER TABLE orders ADD COLUMN next_follow_up_at TEXT;
ALTER TABLE orders ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';

CREATE INDEX orders_follow_up_idx
  ON orders (follow_up_status, next_follow_up_at, updated_at DESC);

CREATE TABLE notification_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'new_inquiry', 'new_offer', 'order_status_changed'
  )),
  delivery_status TEXT NOT NULL DEFAULT 'recorded'
    CHECK (delivery_status IN ('recorded', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  failure_message TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX notification_events_order_idx
  ON notification_events (order_id, created_at DESC, id DESC);

CREATE TRIGGER orders_new_inquiry_notification
AFTER INSERT ON orders
BEGIN
  INSERT INTO notification_events
    (id, order_id, event_type, delivery_status, details_json)
  VALUES
    ('event-' || lower(hex(randomblob(16))), NEW.id, 'new_inquiry', 'recorded',
     json_object('source', 'public_inquiry'));
END;

CREATE TRIGGER offers_new_offer_notification
AFTER INSERT ON offers
BEGIN
  INSERT INTO notification_events
    (id, order_id, event_type, delivery_status, details_json)
  SELECT
    'event-' || lower(hex(randomblob(16))), oi.order_id, 'new_offer', 'recorded',
    json_object(
      'proposedBy', NEW.proposed_by,
      'offerId', NEW.id,
      'amountMinor', NEW.amount_minor,
      'currency', NEW.currency
    )
  FROM order_items oi
  WHERE oi.id = NEW.order_item_id;
END;

CREATE TRIGGER orders_status_change_notification
AFTER UPDATE OF status ON orders
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO notification_events
    (id, order_id, event_type, delivery_status, details_json)
  VALUES
    ('event-' || lower(hex(randomblob(16))), NEW.id, 'order_status_changed', 'recorded',
     json_object('statusFrom', OLD.status, 'statusTo', NEW.status));
END;
