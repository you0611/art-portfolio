PRAGMA foreign_keys = ON;

CREATE TABLE site_profiles (
  id TEXT PRIMARY KEY CHECK (id = 'main'),
  artist_name_zh TEXT NOT NULL,
  artist_name_en TEXT NOT NULL,
  artist_bio_zh TEXT NOT NULL,
  artist_bio_en TEXT NOT NULL,
  artist_statement_zh TEXT NOT NULL,
  artist_statement_en TEXT NOT NULL,
  hero_title_zh TEXT NOT NULL,
  hero_title_en TEXT NOT NULL,
  hero_text_zh TEXT NOT NULL,
  hero_text_en TEXT NOT NULL,
  hero_record_zh TEXT NOT NULL,
  hero_record_en TEXT NOT NULL,
  contact_text_zh TEXT NOT NULL,
  contact_text_en TEXT NOT NULL,
  contact_process_zh TEXT NOT NULL,
  contact_process_en TEXT NOT NULL,
  contact_info_text_zh TEXT NOT NULL,
  contact_info_text_en TEXT NOT NULL,
  activity_intro_zh TEXT NOT NULL,
  activity_intro_en TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE site_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('timeline', 'activity', 'person', 'collaboration')),
  year_label TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_zh TEXT NOT NULL,
  body_en TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  content_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (content_status IN ('draft', 'published', 'archived')),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order BETWEEN 0 AND 100000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX site_entries_public_idx
  ON site_entries (content_status, kind, display_order, id);

CREATE TABLE site_content_revisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('site_profile', 'site_entry')),
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  admin_email TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX site_content_revisions_entity_idx
  ON site_content_revisions (entity_type, entity_id, version DESC, created_at DESC);

INSERT INTO site_profiles (
  id,
  artist_name_zh, artist_name_en,
  artist_bio_zh, artist_bio_en,
  artist_statement_zh, artist_statement_en,
  hero_title_zh, hero_title_en,
  hero_text_zh, hero_text_en,
  hero_record_zh, hero_record_en,
  contact_text_zh, contact_text_en,
  contact_process_zh, contact_process_en,
  contact_info_text_zh, contact_info_text_en,
  activity_intro_zh, activity_intro_en
) VALUES ('main', '游祥龙', 'You Xianglong', '中国美术家协会会员，中国民族画院聘用画家、研究员，广东省美术家协会会员。作品曾在国展中屡次获奖，并被贵州美术馆、江苏美术馆、北京民族文化宫、尹山湖美术馆、大芬美术馆、李自健美术馆等收藏。作品《踩芦笙》2020年获百家金陵收藏奖，《江南行》作为江苏交通版权卡出版发行。', 'You Xianglong is a member of the China Artists Association, a painter and researcher of the China National Art Institute, and a member of the Guangdong Artists Association. His oil paintings have been selected for national exhibitions, received awards, and entered institutional collections.', '以江南水色、人物叙事与民族记忆，展开当代中国油画的个人表达。', 'A personal language of contemporary Chinese oil painting shaped by Jiangnan waterscapes, human narratives, and cultural memory.', '游祥龙', 'You Xianglong', '在江南水色与人物叙事之间，记录时间、乡土与人的精神轮廓。', 'Between Jiangnan waterscapes and human narratives, the paintings trace memory, place, and spirit.', '中国美术家协会会员 · 深圳大芬艺术社区', 'Member of the China Artists Association · Shenzhen Dafen art community', '选择想了解的作品并留下联系方式，工作室会依据作品状态与你进一步沟通。提交后会生成一个咨询编号，记录保存在服务端后台。', 'Select a work and leave your contact details. The studio will follow up according to its current availability. A reference is created and the inquiry is stored on the server.', '提交后，工作室会先确认作品状态，再与你沟通收藏方式；运输与付款会另行协商。', 'After you submit, the studio will confirm availability and discuss the collecting process with you; shipping and payment are arranged separately.', '欢迎致电或到访工作室，了解作品收藏与艺术交流。', 'Call or visit the studio to discuss collecting works and artistic exchange.', '这里将发布工作室展览、交流与公共活动的最新消息。', 'Studio exhibitions, exchanges, and public events will be announced here.');

INSERT INTO site_entries (
  id, kind, year_label, title_zh, title_en, body_zh, body_en,
  source_url, content_status, display_order
) VALUES
  ('timeline-001', 'timeline', '2026', '', '', '作品《她系列八》入选中国美协新文艺群体美术作品展。', 'She Series No. 8 selected for the China Artists Association New Literary & Art Groups Exhibition.', '', 'published', 1),
  ('timeline-002', 'timeline', '2025', '', '', '作品《她系列八》参加"东方之光"中韩艺术交流展（韩国首尔）。', 'She Series No. 8 shown in ''Light of the East'' China-Korea Art Exchange (Seoul).', '', 'published', 2),
  ('timeline-003', 'timeline', '2025', '', '', '作品《她系列六》入选第四届深圳大芬国际油画双年展。', 'She Series VI selected for the 4th Shenzhen Dafen International Oil Painting Biennale.', '', 'published', 3),
  ('timeline-004', 'timeline', '2024', '', '', '作品《她系列七》入选"红岩清风"廉洁文化美术作品展。', 'She Series VII selected for the ''Red Rock Breeze'' Clean Culture Art Exhibition.', '', 'published', 4),
  ('timeline-005', 'timeline', '2024', '', '', '作品《喀什大巴扎三》入选陆海之约——第十二届中国西部大地情中国画、油画作品展。', 'Kashgar Grand Bazaar III selected for the 12th China Western Landscape Art Exhibition.', '', 'published', 5),
  ('timeline-006', 'timeline', '2023', '', '', '作品《泊 NO.6》《泊 NO.8》入选"得境取象"第三届东亿中国油画作品展。', 'Mooring No.6 & No.8 selected for the 3rd Dongyi China Oil Painting Exhibition.', '', 'published', 6),
  ('timeline-007', 'timeline', '2023', '', '', '作品《乡情系列八》入选第二届"华夏意韵——中国油画精品展"。', 'Nostalgia Series VIII selected for the 2nd Huaxia Yiyun China Oil Painting Exhibition.', '', 'published', 7),
  ('timeline-008', 'timeline', '2022', '', '', '作品《高二那年》入选"时代·肖像"2022中国油画作品展。', 'That Year in Grade Two selected for the 2022 Era·Portrait China Oil Painting Exhibition.', '', 'published', 8),
  ('timeline-009', 'timeline', '2022', '', '', '作品《岁月静好》入选"时代颂歌"2022中国百家金陵油画展，入会资格。', 'Peaceful Times selected for the 2022 Era Ode China Baijia Jinling Exhibition (membership qualification).', '', 'published', 9),
  ('timeline-010', 'timeline', '2022', '', '', '作品《笙声不息二》入选2022第三届深圳大芬国际油画双年展（馆藏）。', 'Lusheng Sound Never Ends II selected for the 3rd Shenzhen Dafen International Oil Painting Biennale (collection).', '', 'published', 10),
  ('timeline-011', 'timeline', '2022', '', '', '作品《笙声不息》入选2022全国少数民族美术作品展，入会资格（馆藏）。', 'Lusheng Sound Never Ends selected for the 2022 National Minority Art Exhibition (membership qualification, collection).', '', 'published', 11),
  ('timeline-012', 'timeline', '2022', '', '', '作品《她系列五》入选"悲鸿风度"首届油画双年展，入会资格。', 'She Series V selected for the 1st Beihong Grace Oil Painting Biennale (membership qualification).', '', 'published', 12),
  ('timeline-013', 'timeline', '2022', '', '', '作品《红》入选"心境物语——首届中国写意油画静物专题研究展"（馆藏）。', 'Red selected for the 1st Chinese Xieyi Oil Painting Still Life Exhibition (collection).', '', 'published', 13),
  ('timeline-014', 'timeline', '2021', '', '', '作品《她系列三》入选"江南如画中国油画作品展2021"。', 'She Series III selected for the 2021 Jiangnan as in Painting China Oil Painting Exhibition.', '', 'published', 14),
  ('timeline-015', 'timeline', '2021', '', '', '作品《她系列二》入选首届"倪云林"全国美术作品展（中国画、油画）。', 'She Series II selected for the 1st Ni Yunlin National Art Exhibition.', '', 'published', 15),
  ('timeline-016', 'timeline', '2021', '', '', '作品《她系列一》入选第五届"时代之光"中国油画展，入会资格。', 'She Series I selected for the 5th Light of the Era China Oil Painting Exhibition (membership qualification).', '', 'published', 16),
  ('timeline-017', 'timeline', '2020', '', '', '作品《路上》入选"第九届全国（大芬）青年油画作品展"。', 'On the Road selected for the 9th National (Dafen) Youth Oil Painting Exhibition.', '', 'published', 17),
  ('timeline-018', 'timeline', '2020', '', '', '作品《踩芦笙》入选"百年梦圆2020"中国百家金陵油画作品展，获收藏奖（馆藏）。', 'Cai Lusheng selected for the 2020 China Baijia Jinling Oil Painting Exhibition, Collection Award (collection).', '', 'published', 18),
  ('timeline-019', 'timeline', '2019', '', '', '作品《江南行》入选"诗意大运河"2019年全国油画作品展，入会资格（馆藏）。', 'Journey to Jiangnan selected for the 2019 Poetic Grand Canal National Oil Painting Exhibition (membership qualification, collection).', '', 'published', 19),
  ('timeline-020', 'timeline', '2019', '', '', '作品《归去来兮》入选"得境取象"第二届东亿中国油画作品展。', 'Return selected for the 2nd Dongyi China Oil Painting Exhibition.', '', 'published', 20),
  ('timeline-021', 'timeline', '2019', '', '', '作品《乡情》入选徐悲鸿画院庆祝新中国成立70周年油画展。', 'Nostalgia selected for the Xu Beihong Art Academy 70th Anniversary Oil Painting Exhibition.', '', 'published', 21),
  ('timeline-022', 'timeline', '2016', '', '', '作品《传承》入选"同心筑梦"第二届中国民族美术双年展，入会资格（馆藏）。', 'Inheritance selected for the 2nd China National Art Biennale (membership qualification, collection).', '', 'published', 22);

