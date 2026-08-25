DROP TRIGGER IF EXISTS offers_new_offer_notification;

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

CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  notification_event_id TEXT NOT NULL REFERENCES notification_events(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('admin', 'customer')),
  recipient_email TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL CHECK (template IN (
    'inquiry_admin', 'customer_offer_admin', 'admin_offer_customer'
  )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider_message_id TEXT,
  failure_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_at TEXT
);

CREATE UNIQUE INDEX email_outbox_event_recipient_idx
  ON email_outbox (notification_event_id, recipient_kind);

CREATE INDEX email_outbox_dispatch_idx
  ON email_outbox (status, created_at ASC, id ASC);

CREATE TRIGGER notification_events_email_outbox
AFTER INSERT ON notification_events
WHEN NEW.event_type = 'new_inquiry'
  OR (NEW.event_type = 'new_offer' AND json_extract(NEW.details_json, '$.proposedBy') IN ('customer', 'admin'))
BEGIN
  INSERT INTO email_outbox
    (id, notification_event_id, order_id, recipient_kind, recipient_email, template)
  SELECT
    'email-' || lower(hex(randomblob(16))),
    NEW.id,
    o.id,
    CASE
      WHEN NEW.event_type = 'new_offer' AND json_extract(NEW.details_json, '$.proposedBy') = 'admin'
        THEN 'customer'
      ELSE 'admin'
    END,
    CASE
      WHEN NEW.event_type = 'new_offer' AND json_extract(NEW.details_json, '$.proposedBy') = 'admin'
        THEN o.customer_email
      ELSE ''
    END,
    CASE
      WHEN NEW.event_type = 'new_inquiry' THEN 'inquiry_admin'
      WHEN json_extract(NEW.details_json, '$.proposedBy') = 'customer' THEN 'customer_offer_admin'
      ELSE 'admin_offer_customer'
    END
  FROM orders o
  WHERE o.id = NEW.order_id;
END;
