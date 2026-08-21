PRAGMA foreign_keys = ON;

CREATE TABLE artworks (
  id TEXT PRIMARY KEY,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  category TEXT NOT NULL,
  medium TEXT NOT NULL,
  dimensions TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2200),
  image_url TEXT NOT NULL,
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  detail_path_zh TEXT,
  detail_path_en TEXT,
  content_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (content_status IN ('draft', 'published', 'archived')),
  sale_status TEXT NOT NULL DEFAULT 'not_for_sale'
    CHECK (sale_status IN ('available', 'held', 'sold', 'not_for_sale')),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3),
  price_visibility TEXT NOT NULL DEFAULT 'on_request'
    CHECK (price_visibility IN ('on_request', 'private_quote')),
  negotiation_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (negotiation_enabled IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX artworks_public_catalog_idx
  ON artworks (content_status, display_order, id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN (
      'submitted', 'negotiating', 'awaiting_payment', 'paid',
      'cancelled', 'fulfilled', 'refunded'
    )),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_country_code TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'zh'
    CHECK (preferred_language IN ('zh', 'en')),
  contact_note TEXT NOT NULL DEFAULT '',
  shipping_note TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX orders_status_created_idx ON orders (status, created_at DESC);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  artwork_id TEXT NOT NULL REFERENCES artworks(id) ON DELETE RESTRICT,
  agreed_amount_minor INTEGER CHECK (agreed_amount_minor IS NULL OR agreed_amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (order_id, artwork_id)
);

CREATE INDEX order_items_artwork_idx ON order_items (artwork_id);

CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('customer', 'admin')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  responded_at TEXT
);

CREATE INDEX offers_order_item_created_idx ON offers (order_item_id, created_at DESC);

CREATE TABLE inventory_holds (
  id TEXT PRIMARY KEY,
  artwork_id TEXT NOT NULL REFERENCES artworks(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released', 'converted', 'expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  released_at TEXT
);

CREATE UNIQUE INDEX one_active_hold_per_artwork_idx
  ON inventory_holds (artwork_id)
  WHERE status = 'active';

CREATE INDEX inventory_holds_expiry_idx ON inventory_holds (status, expires_at);

CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX admin_audit_entity_idx
  ON admin_audit_log (entity_type, entity_id, created_at DESC);

INSERT INTO artworks (
  id, title_zh, title_en, category, medium, dimensions, year, image_url,
  description_zh, description_en, detail_path_zh, detail_path_en,
  content_status, sale_status, display_order
) VALUES
  ('guiquilaixi', '归去来兮', 'Return', '风景', '布面油画', '90 × 135 cm', 2019, '/assets/guiquilaixi.jpg', '入选“得境取象”第二届东亿中国油画作品展。', 'Selected for the 2nd Dongyi China Oil Painting Exhibition.', NULL, NULL, 'published', 'available', 1),
  ('shengsheng-2', '笙声不息（二）', 'Lusheng Sound Never Ends II', '民族题材', '布面油画', '150 × 120 cm', 2022, '/assets/shengsheng-2.jpg', '2022年入选第三届深圳大芬国际油画双年展（馆藏）。', 'Selected for the 3rd Shenzhen Dafen International Oil Painting Biennale.', NULL, NULL, 'published', 'available', 2),
  ('shengsheng-3', '笙声不息（三）', 'Lusheng Sound Never Ends III', '民族题材', '布面油画', '150 × 120 cm', 2022, '/assets/shengsheng-3.jpg', '笙声不息系列第三幅，以芦笙舞展现民族文化生命力。', 'Third in the Lusheng series, celebrating ethnic cultural vitality.', NULL, NULL, 'published', 'available', 3),
  ('chengzhongcun', '城中村——红色记忆', 'Urban Village – Red Memory', '城市记忆', '布面油画', '130 × 160 cm', 2020, '/assets/chengzhongcun.jpg', '记录城市化进程中的空间记忆与色彩张力。', 'Spatial memory and color tension in urbanization.', NULL, NULL, 'published', 'sold', 4),
  ('banyan', '池塘边的大榕树', 'Banyan by the Pond', '风景', '布面油画', '122 × 155 cm', 2020, '/assets/banyan.jpg', '描绘南方乡间的静谧与生命力。', 'Serenity and vitality of the southern countryside.', NULL, NULL, 'published', 'sold', 5),
  ('on-the-road', '路上', 'On the Road', '人物与叙事', '布面油画', '180 × 130 cm', 2020, '/assets/on-the-road.jpg', '入选第九届全国（大芬）青年油画作品展。', 'Selected for the 9th National Youth Oil Painting Exhibition.', NULL, NULL, 'published', 'available', 6),
  ('she-series-1', '她系列（一）', 'She Series I', '她系列', '布面油画', '150 × 120 cm', 2020, '/assets/she-series-1.jpg', '2021年入选第五届“时代之光”中国油画展，入会资格。', 'Selected for the 5th Light of the Era China Oil Painting Exhibition.', NULL, NULL, 'published', 'available', 7),
  ('she-series-2', '她系列（二）', 'She Series II', '她系列', '布面油画', '120 × 150 cm', 2020, '/assets/she-series-2.jpg', '2021年入选首届“倪云林”全国美术作品展。', 'Selected for the 1st Ni Yunlin National Art Exhibition.', NULL, NULL, 'published', 'available', 8),
  ('she-series-3', '她系列（三）', 'She Series III', '她系列', '布面油画', '150 × 120 cm', 2021, '/assets/she-series-3.jpg', '2021年入选“江南如画”中国油画作品展。', 'Selected for the 2021 Jiangnan as in Painting Exhibition.', NULL, NULL, 'published', 'available', 9),
  ('shengsheng-1', '笙声不息（一）', 'Lusheng Sound Never Ends I', '民族题材', '布面油画', '150 × 120 cm', 2022, '/assets/shengsheng-1.jpg', '2022年入选全国少数民族美术作品展，馆藏于北京民族文化宫。', 'Selected for the 2022 National Minority Art Exhibition.', NULL, NULL, 'published', 'sold', 10),
  ('ta-series-5', '她系列五', 'She Series V', '她系列', '布面油画', '160 × 130 cm', 2021, '/assets/ta-series-5.jpg', '2022年入选“悲鸿风度”首届油画双年展。', 'Selected for the 1st Beihong Grace Oil Painting Biennale.', '/works/ta-series-5.html', '/works/ta-series-5-en.html', 'published', 'available', 11),
  ('jiangnan-2024', '江南', 'Jiangnan', '江南系列', '布面油画', '140 × 160 cm', 2024, '/assets/jiangnan-2024.jpg', '以江南水乡的湿润光色为线索。', 'A Jiangnan waterscape of humid light and quiet rhythm.', '/works/jiangnan-2024.html', '/works/jiangnan-2024-en.html', 'published', 'available', 12),
  ('jiangnan-series-6', '江南系列六', 'Jiangnan Series VI', '江南系列', '布面油画', '120 × 120 cm', 2025, '/assets/jiangnan-series-6.jpg', '方形构图中的江南诗性秩序。', 'A square-format Jiangnan poetic order.', '/works/jiangnan-series-6.html', '/works/jiangnan-series-6-en.html', 'published', 'available', 13),
  ('grass-2024', '小草', 'Grass', '人物与叙事', '布面油画', '120 × 120 cm', 2024, '/assets/grass-2024.jpg', '关注普通生命的韧性。', 'Resilience of ordinary life.', '/works/grass-2024.html', '/works/grass-2024-en.html', 'published', 'available', 14),
  ('flower-2025', '花非花', 'Flower, Not Flower', '人物与叙事', '布面油画', '120 × 120 cm', 2025, '/assets/flower-2025.jpg', '在具象与意象之间展开。', 'Between figuration and suggestion.', '/works/flower-2025.html', '/works/flower-2025-en.html', 'published', 'available', 15),
  ('jiangnan-trip', '江南行', 'Journey to Jiangnan', '江南系列', '布面油画', '130 × 160 cm', 2019, '/assets/jiangnan-trip.jpg', '入选“诗意大运河”2019年全国油画作品展。', 'Selected for the 2019 Poetic Grand Canal Exhibition.', '/works/jiangnan-trip.html', '/works/jiangnan-trip-en.html', 'published', 'sold', 16),
  ('cai-lusheng', '踩芦笙', 'Cai Lusheng', '民族题材', '布面油画', '160 × 130 cm', 2020, '/assets/cai-lusheng.jpg', '入选“百年梦圆2020”中国百家金陵油画作品展并获收藏奖。', 'Selected for the 2020 Baijia Jinling Exhibition, Collection Award.', '/works/cai-lusheng.html', '/works/cai-lusheng-en.html', 'published', 'sold', 17);
